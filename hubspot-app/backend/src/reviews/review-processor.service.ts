import { Injectable, Logger } from "@nestjs/common";
import { ReplyStatus, RiskLevel } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AutoReplyService } from "../replies/auto-reply.service";
import { SentimentRiskService } from "../safety/sentiment-risk.service";
import { ReviewsService, ReviewWithDetail } from "./reviews.service";

/** At or below this many stars, a review WITH a comment always waits for a person. */
const ALWAYS_HOLD_RATING = 2;

/**
 * Takes a stored review and runs it through assess risk -> select a reply via
 * the business's auto-reply rules -> route to a scheduled draft or to Alerts.
 *
 * A matching rule gives a draft that auto-posts after the rule's delay (only if
 * the business has switched auto-replies on). It is HELD for a person instead
 * when any of these is true, whatever the business's rules say:
 * - no rule matches
 * - 1-2 stars with a written comment (the plan's fixed safety rule)
 * - the comment raises a sensitive topic (legal, refund, safety, conduct...)
 *
 * Nothing is posted here; ReviewPosterService does that.
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

  /** Processes everything still awaiting a draft (one business, or all). */
  async processPending(brandId?: string): Promise<{ processed: number; failed: number }> {
    const pending = await this.reviews.findUnprocessed(brandId);
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
    // Already answered publicly (by us, or by the owner on Google). Re-drafting
    // would overwrite a live reply, so an edit to such a review is only recorded.
    if (review.reply?.status === ReplyStatus.POSTED) {
      await this.reviews.markProcessed(review.id);
      return;
    }

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
      businessName: review.location.brand.name,
      locationName: review.location.name,
      seed: review.externalReviewId || review.id,
    });

    const holdReason = this.holdReason(review, assessment.riskLevel, assessment.riskFlags, assessment.reason);
    const held = !selection.draft || holdReason !== null;
    const status = held ? ReplyStatus.PENDING_APPROVAL : ReplyStatus.GENERATED;
    // A held review still gets the rule's wording as a starting point when
    // there is one, so the person only has to adjust it.
    const draftText = selection.draft ?? selection.note ?? "No matching auto-reply rule. Please write a reply manually.";
    const aiModel = selection.templateName ?? "manual";

    const autoPostAt =
      !held && selection.autoPostable && selection.delayHours != null
        ? new Date(Date.now() + selection.delayHours * 60 * 60 * 1000)
        : null;

    await this.prisma.reply.upsert({
      where: { reviewId: review.id },
      update: { aiDraft: draftText, status, aiProvider: "template-rule", aiModel, autoPostAt },
      create: { reviewId: review.id, aiDraft: draftText, status, aiProvider: "template-rule", aiModel, autoPostAt },
    });
    await this.prisma.review.update({ where: { id: review.id }, data: { hubspotDirty: true } });
    await this.reviews.markProcessed(review.id);

    if (status === ReplyStatus.PENDING_APPROVAL) {
      await this.notifications.notifyNeedsApproval(review, holdReason ?? selection.note ?? assessment.reason);
    }

    this.logger.log(
      `Review ${review.id} (${review.rating}star) -> ${status}` +
        (selection.ruleName ? ` [rule "${selection.ruleName}", ${selection.templateName}]` : " [no matching rule]") +
        (holdReason ? ` [held: ${holdReason}]` : ""),
    );
  }

  /** Why this review must wait for a person even if a rule matched, or null. */
  private holdReason(review: ReviewWithDetail, riskLevel: RiskLevel, riskFlags: string[], reason: string): string | null {
    const hasComment = review.reviewText.trim().length > 0;
    if (review.rating <= ALWAYS_HOLD_RATING && hasComment) {
      return `${review.rating}-star review with a comment - always held for a person to approve.`;
    }
    const sensitive = riskFlags.filter((f) => f !== "low_rating");
    if (riskLevel === RiskLevel.HIGH && sensitive.length > 0) {
      return reason;
    }
    return null;
  }
}
