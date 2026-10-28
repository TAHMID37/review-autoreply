import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Brand, BrandStatus, Prisma, Reply, ReplyStatus } from "@prisma/client";
import { BillingService } from "../billing/billing.service";
import { PrismaService } from "../common/prisma/prisma.service";
import { Env } from "../config/env.schema";
import { APP_ENV } from "../config/env.token";
import { GoogleReplyWriter } from "./google-reply-writer";
import { PlatformAccountsService } from "./platform-accounts.service";

/** Replies we will never (re)post: already public, or explicitly rejected. */
const UNPOSTABLE: ReplyStatus[] = [ReplyStatus.POSTED, ReplyStatus.REJECTED];
const BATCH_SIZE = 50;

/**
 * Writes replies back to Google, as the business owner.
 *
 * Two kinds of posting, with different gates:
 * - Approved by a person: posts once the platform switch (AUTO_POST_ENABLED)
 *   is on and the business's subscription is active.
 * - Automatic (a draft whose rule delay has passed): additionally requires the
 *   business to have switched auto-replies on with consent, and only for
 *   reviews left after that moment - so the backlog is never auto-replied.
 */
@Injectable()
export class ReviewPosterService {
  private readonly logger = new Logger(ReviewPosterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: PlatformAccountsService,
    private readonly writer: GoogleReplyWriter,
    private readonly billing: BillingService,
    @Inject(APP_ENV) private readonly env: Env,
  ) {}

  get enabled(): boolean {
    return this.env.AUTO_POST_ENABLED;
  }

  /**
   * Posts one reply now (a staff member deliberately posting it). Marks it
   * POSTED, or FAILED with the reason. Idempotent for an already-posted reply.
   */
  async postReply(brandId: string, replyId: string): Promise<Reply> {
    const reply = await this.prisma.reply.findFirst({
      where: { id: replyId, review: { location: { brandId } } },
      include: { review: { include: { location: { include: { brand: { include: { subscription: true } } } } } } },
    });
    if (!reply) throw new NotFoundException(`Reply ${replyId} not found`);
    if (reply.status === ReplyStatus.POSTED) return reply;
    if (UNPOSTABLE.includes(reply.status)) {
      throw new BadRequestException(`Reply ${replyId} is ${reply.status} and cannot be posted.`);
    }
    if (!this.billing.isServiceActive(reply.review.location.brand.subscription)) {
      throw new ForbiddenException("Replies are paused until billing is sorted out. Check the Billing page.");
    }

    const text = (reply.finalReply?.trim() || reply.aiDraft || "").trim();
    if (!text) throw new BadRequestException("Reply has no text to post.");

    const link = await this.prisma.platformLocation.findFirst({
      where: { locationId: reply.review.locationId, platformAccount: { status: "CONNECTED" } },
      include: { platformAccount: true },
    });
    if (!link) throw new BadRequestException("This review's location is not linked to a connected Google account.");

    const reviewResource = `${link.externalLocationId}/reviews/${reply.review.externalReviewId}`;

    try {
      const token = await this.accounts.getValidAccessToken(link.platformAccount);
      await this.writer.updateReply(token, reviewResource, text);
      const [posted] = await this.prisma.$transaction([
        this.prisma.reply.update({
          where: { id: reply.id },
          data: { status: ReplyStatus.POSTED, postedAt: new Date(), failureReason: null },
        }),
        this.prisma.review.update({ where: { id: reply.reviewId }, data: { hubspotDirty: true } }),
      ]);
      this.logger.log(`Posted reply ${reply.id} to Google (${reviewResource}).`);
      return posted;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.$transaction([
        this.prisma.reply.update({ where: { id: reply.id }, data: { status: ReplyStatus.FAILED, failureReason: message } }),
        this.prisma.review.update({ where: { id: reply.reviewId }, data: { hubspotDirty: true } }),
      ]);
      this.logger.error(`Failed to post reply ${reply.id}: ${message}`);
      throw error;
    }
  }

  /** Posts everything due for every paid, installed business. */
  async postDueAll(): Promise<{ posted: number; failed: number }> {
    if (!this.enabled) return { posted: 0, failed: 0 };
    const brands = await this.prisma.brand.findMany({
      where: { status: BrandStatus.ACTIVE, ...(await this.billing.activeBrandFilter()) },
    });
    const total = { posted: 0, failed: 0 };
    for (const brand of brands) {
      const r = await this.postDue(brand);
      total.posted += r.posted;
      total.failed += r.failed;
    }
    return total;
  }

  /** Posts one business's approved replies and its auto-replies that are due. */
  async postDue(brand: Brand): Promise<{ posted: number; failed: number }> {
    if (!this.enabled || brand.status !== BrandStatus.ACTIVE) return { posted: 0, failed: 0 };

    const ofBrand: Prisma.ReviewWhereInput = { location: { brandId: brand.id, syncEnabled: true }, removedAt: null };
    const due: Prisma.ReplyWhereInput[] = [{ status: ReplyStatus.APPROVED, review: ofBrand }];
    if (brand.autoReplyEnabled && brand.autoReplyStartAt) {
      due.push({
        status: ReplyStatus.GENERATED,
        autoPostAt: { not: null, lte: new Date() },
        review: { ...ofBrand, reviewedAt: { gte: brand.autoReplyStartAt } },
      });
    }

    const replies = await this.prisma.reply.findMany({
      where: { OR: due },
      orderBy: { autoPostAt: "asc" },
      take: BATCH_SIZE,
      select: { id: true },
    });

    let posted = 0;
    let failed = 0;
    for (const reply of replies) {
      try {
        await this.postReply(brand.id, reply.id);
        posted++;
      } catch {
        failed++;
      }
    }
    if (posted || failed) this.logger.log(`Auto-post (${brand.name}): ${posted} posted, ${failed} failed.`);
    return { posted, failed };
  }
}
