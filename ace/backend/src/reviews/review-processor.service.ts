import { Injectable, Logger } from "@nestjs/common";
import { ReplyStatus } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AutoReplyService } from "../replies/auto-reply.service";
import { SentimentRiskService } from "../safety/sentiment-risk.service";
import { ReviewsService, ReviewWithDetail } from "./reviews.service";

/**
 * Takes a stored review and runs it through assess risk -> select a reply via
 * the configurable auto-reply rules -> route to draft or human approval.
 *
 * Routing mirrors Birdeye: the DB-backed auto-reply rules (rating + comment)
 * decide which template is used. A matching rule -> a ready draft (Birdeye would
 * auto-post it after the rule's delay). No matching rule (e.g. 1-2 stars with a
 * comment) -> held for a person.
 *
 * DRAFT ONLY: nothing is posted to Google here. Posting is a separate build.
 */
@Injectable()
export class ReviewProcessorService {
  private readonly logger = new Logger(ReviewProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: ReviewsService,
    private readonly risk: SentimentRiskService,
    private readonly autoReply: AutoReplyService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Processes everything still awaiting a draft. Returns how many succeeded. */
  async processPending(): Promise<{ processed: number; failed: number }> {
    const pending = await this.reviews.findUnprocessed();
    let processed = 0;
    let failed = 0;

    for (const review of pending) {
      try {
        await this.processOne(review);
        processed++;
      } catch (error) {
        failed++;
        this.logger.error(
          `Failed to process review ${review.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return { processed, failed };
  }

  async processOne(review: ReviewWithDetail): Promise<void> {
    // Risk assessment is stored for display/flags on the dashboard; the auto vs
    // manual decision follows the Birdeye rules (below), not the risk level.
    const assessment = this.risk.assess(review.rating, review.reviewText);
    await this.prisma.reviewAnalysis.upsert({
      where: { reviewId: review.id },
      update: {
        sentiment: assessment.sentiment,
        riskLevel: assessment.riskLevel,
        riskFlags: assessment.riskFlags,
      },
      create: {
        reviewId: review.id,
        sentiment: assessment.sentiment,
        riskLevel: assessment.riskLevel,
        riskFlags: assessment.riskFlags,
      },
    });

    const selection = await this.autoReply.selectDraft({
      brandId: review.location.brandId,
      rating: review.rating,
      reviewText: review.reviewText,
      reviewerName: review.reviewerName,
      seed: review.externalReviewId || review.id,
    });

    // A rule matched -> ready draft (Birdeye would auto-post after the delay).
    // No rule matched -> held for a person.
    const status = selection.draft ? ReplyStatus.GENERATED : ReplyStatus.PENDING_APPROVAL;
    const draftText = selection.draft ?? selection.note ?? "No matching auto-reply rule. Please write a reply manually.";
    const aiModel = selection.templateName ?? "manual";

    // Eligible-to-post time = now + the rule's delay (Birdeye posts after a
    // delay). Only for auto-postable drafts; held replies have no auto-post time.
    const autoPostAt =
      selection.autoPostable && selection.delayHours != null
        ? new Date(Date.now() + selection.delayHours * 60 * 60 * 1000)
        : null;

    await this.prisma.reply.upsert({
      where: { reviewId: review.id },
      update: { aiDraft: draftText, status, aiProvider: "birdeye-rule", aiModel, autoPostAt },
      create: { reviewId: review.id, aiDraft: draftText, status, aiProvider: "birdeye-rule", aiModel, autoPostAt },
    });

    await this.reviews.markProcessed(review.id);

    if (status === ReplyStatus.PENDING_APPROVAL) {
      await this.notifications.notifyNeedsApproval(review, selection.note ?? assessment.reason);
    }

    this.logger.log(
      `Review ${review.id} (${review.rating}star) -> ${status}` +
        (selection.ruleName ? ` [rule "${selection.ruleName}", ${selection.templateName}, delay ${selection.delayHours}h]` : " [no matching rule]"),
    );
  }
}
