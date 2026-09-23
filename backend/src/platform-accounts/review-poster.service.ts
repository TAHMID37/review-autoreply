import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Reply, ReplyStatus } from "@prisma/client";
import { Env } from "../config/env.schema";
import { APP_ENV } from "../config/env.token";
import { PrismaService } from "../common/prisma/prisma.service";
import { GoogleReplyWriter } from "./google-reply-writer";
import { PlatformAccountsService } from "./platform-accounts.service";

/** Replies we will never (re)post: already public, or explicitly rejected. */
const UNPOSTABLE: ReplyStatus[] = [ReplyStatus.POSTED, ReplyStatus.REJECTED];

/**
 * Writes approved/eligible replies back to Google. All posting is gated behind
 * AUTO_POST_ENABLED, so with the switch off nothing is ever sent - the system
 * stays draft-only. Uses the write-only GoogleReplyWriter; the read-only client
 * is never involved.
 */
@Injectable()
export class ReviewPosterService {
  private readonly logger = new Logger(ReviewPosterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: PlatformAccountsService,
    private readonly writer: GoogleReplyWriter,
    @Inject(APP_ENV) private readonly env: Env,
  ) {}

  get enabled(): boolean {
    return this.env.AUTO_POST_ENABLED;
  }

  /**
   * Posts a single reply to Google as the business owner on the review's
   * location, then marks it POSTED (or FAILED with the reason). Idempotent:
   * a reply that is already POSTED is returned untouched.
   */
  async postReply(replyId: string): Promise<Reply> {
    if (!this.enabled) {
      throw new ForbiddenException("Posting is disabled (set AUTO_POST_ENABLED=true to post to Google).");
    }

    const reply = await this.prisma.reply.findUnique({ where: { id: replyId }, include: { review: true } });
    if (!reply) throw new NotFoundException(`Reply ${replyId} not found`);
    if (reply.status === ReplyStatus.POSTED) return reply;
    if (UNPOSTABLE.includes(reply.status)) {
      throw new BadRequestException(`Reply ${replyId} is ${reply.status} and cannot be posted.`);
    }

    const text = (reply.finalReply?.trim() || reply.aiDraft || "").trim();
    if (!text) throw new BadRequestException("Reply has no text to post.");

    // The review's connected Google location + owning account.
    const link = await this.prisma.platformLocation.findFirst({
      where: { locationId: reply.review.locationId },
      include: { platformAccount: true },
    });
    if (!link) throw new BadRequestException("This review's location is not linked to a connected Google account.");

    const reviewResource = `${link.externalLocationId}/reviews/${reply.review.externalReviewId}`;

    try {
      const token = await this.accounts.getValidAccessToken(link.platformAccount);
      await this.writer.updateReply(token, reviewResource, text);
      const posted = await this.prisma.reply.update({
        where: { id: reply.id },
        data: { status: ReplyStatus.POSTED, postedAt: new Date(), failureReason: null },
      });
      this.logger.log(`Posted reply ${reply.id} to Google (${reviewResource}).`);
      return posted;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.reply.update({
        where: { id: reply.id },
        data: { status: ReplyStatus.FAILED, failureReason: message },
      });
      this.logger.error(`Failed to post reply ${reply.id}: ${message}`);
      throw error;
    }
  }

  /**
   * Posts everything currently due: manually APPROVED replies, and auto-postable
   * GENERATED drafts whose rule delay has elapsed. Called by the scheduler only
   * when AUTO_POST_ENABLED. Never throws for a single failure - it records it and
   * moves on.
   */
  async postDue(): Promise<{ posted: number; failed: number }> {
    if (!this.enabled) return { posted: 0, failed: 0 };

    const now = new Date();
    const due = await this.prisma.reply.findMany({
      where: {
        OR: [
          { status: ReplyStatus.APPROVED },
          { status: ReplyStatus.GENERATED, autoPostAt: { not: null, lte: now } },
        ],
      },
      orderBy: { autoPostAt: "asc" },
      take: 50,
    });

    let posted = 0;
    let failed = 0;
    for (const reply of due) {
      try {
        await this.postReply(reply.id);
        posted++;
      } catch {
        failed++;
      }
    }
    if (posted || failed) this.logger.log(`Auto-post run: ${posted} posted, ${failed} failed.`);
    return { posted, failed };
  }
}
