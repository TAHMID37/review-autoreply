import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Platform, Prisma, ReplyStatus, ReviewStatus } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import type { GoogleOwnerReply } from "../platform-accounts/google-reviews.client";
import { IngestReviewDto } from "./dto/ingest-review.dto";
import { ReviewFiltersDto } from "./dto/review-filters.dto";

/** What `upsertFromPlatform` did, so the caller knows whether to run the
 *  AI pipeline (new/edited reviews only) or skip (already seen, unchanged). */
export type IngestOutcome = "created" | "updated" | "unchanged";

/** `Reply.aiProvider` marker for a reply someone posted on Google directly,
 *  outside this dashboard. Such replies count as responded, not auto-replied. */
export const GOOGLE_OWNER_PROVIDER = "google-owner";

const REVIEW_WITH_DETAIL = {
  include: {
    location: { include: { brand: true } },
    reply: true,
    analysis: true,
  },
} satisfies Prisma.ReviewDefaultArgs;

export type ReviewWithDetail = Prisma.ReviewGetPayload<typeof REVIEW_WITH_DETAIL>;

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Stores a review fetched from a platform, keyed on
   * (platform, locationId, externalReviewId).
   *
   * That composite key is what makes re-polling safe: the ingestion job runs
   * every few minutes over the same reviews, and without it every run would
   * create duplicates and re-trigger the AI. It also lets an *edited* review
   * be recognised — same external id, different text — so it updates in place
   * and can be re-replied to, rather than appearing as a second review.
   */
  async upsertFromPlatform(dto: IngestReviewDto): Promise<{ outcome: IngestOutcome; reviewId: string }> {
    const existing = await this.prisma.review.findUnique({
      where: {
        platform_locationId_externalReviewId: {
          platform: dto.platform,
          locationId: dto.locationId,
          externalReviewId: dto.externalReviewId,
        },
      },
    });

    if (!existing) {
      const created = await this.prisma.review.create({
        data: {
          platform: dto.platform,
          locationId: dto.locationId,
          externalReviewId: dto.externalReviewId,
          reviewerName: dto.reviewerName,
          rating: dto.rating,
          reviewText: dto.reviewText,
          reviewedAt: dto.reviewedAt,
          status: ReviewStatus.NEW,
        },
      });
      return { outcome: "created", reviewId: created.id };
    }

    const isEdited = existing.reviewText !== dto.reviewText || existing.rating !== dto.rating;
    if (!isEdited) {
      // Already stored and unchanged — record that we saw it again (and clear
      // any stale removed flag, in case it had briefly disappeared).
      await this.prisma.review.update({
        where: { id: existing.id },
        data: { fetchedAt: new Date(), removedAt: null },
      });
      return { outcome: "unchanged", reviewId: existing.id };
    }

    this.logger.log(`Review ${existing.id} was edited on ${dto.platform} — reprocessing`);
    await this.prisma.review.update({
      where: { id: existing.id },
      data: {
        rating: dto.rating,
        reviewText: dto.reviewText,
        fetchedAt: new Date(),
        status: ReviewStatus.NEW,
        removedAt: null,
      },
    });
    return { outcome: "updated", reviewId: existing.id };
  }

  findAll(filters: ReviewFiltersDto): Promise<ReviewWithDetail[]> {
    // Hide reviews Google no longer serves (filtered/deleted).
    const where: Prisma.ReviewWhereInput = { removedAt: null };

    if (filters.locationId) {
      where.locationId = filters.locationId;
    }
    if (filters.brandId) {
      where.location = { brandId: filters.brandId };
    }
    if (filters.replyStatus) {
      where.reply = { status: filters.replyStatus };
    }
    if (filters.needsApproval) {
      where.reply = { status: ReplyStatus.PENDING_APPROVAL };
    }
    if (filters.search) {
      where.OR = [
        { reviewerName: { contains: filters.search, mode: "insensitive" } },
        { reviewText: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    return this.prisma.review.findMany({
      where,
      ...REVIEW_WITH_DETAIL,
      orderBy: { reviewedAt: "desc" },
      // Generous cap: the dashboard paginates client-side. If the dataset grows
      // well beyond this, switch this endpoint to server-side pagination.
      take: 2000,
    });
  }

  async findById(id: string): Promise<ReviewWithDetail> {
    const review = await this.prisma.review.findUnique({ where: { id }, ...REVIEW_WITH_DETAIL });
    if (!review) {
      throw new NotFoundException(`Review ${id} not found`);
    }
    return review;
  }

  /** Reviews that still need an AI reply generated. */
  findUnprocessed(): Promise<ReviewWithDetail[]> {
    return this.prisma.review.findMany({
      where: { status: ReviewStatus.NEW },
      ...REVIEW_WITH_DETAIL,
      orderBy: { reviewedAt: "asc" },
    });
  }

  markProcessed(id: string) {
    return this.prisma.review.update({
      where: { id },
      data: { status: ReviewStatus.PROCESSED },
    });
  }

  /**
   * Closes out stored reviews that have since been replied to on Google
   * directly (e.g. a low-rated review answered by hand in the Business
   * Profile). Their reply is recorded as POSTED with Google's text, so they
   * leave Alerts and can never be posted a second time. Replies we posted
   * ourselves are already POSTED and left alone. Returns how many changed.
   */
  async markRepliedOnGoogle(locationId: string, answered: GoogleOwnerReply[]): Promise<number> {
    if (answered.length === 0) return 0;

    const stale = await this.prisma.review.findMany({
      where: {
        locationId,
        platform: Platform.GOOGLE,
        externalReviewId: { in: answered.map((a) => a.externalReviewId) },
        OR: [{ reply: null }, { reply: { status: { not: ReplyStatus.POSTED } } }],
      },
      select: { id: true, externalReviewId: true },
    });

    for (const review of stale) {
      const owner = answered.find((a) => a.externalReviewId === review.externalReviewId)!;
      const posted = {
        finalReply: owner.comment,
        status: ReplyStatus.POSTED,
        postedAt: owner.repliedAt,
        aiProvider: GOOGLE_OWNER_PROVIDER,
        aiModel: "manual",
        autoPostAt: null,
        failureReason: null,
      };
      await this.prisma.$transaction([
        this.prisma.reply.upsert({
          where: { reviewId: review.id },
          create: { reviewId: review.id, aiDraft: owner.comment, ...posted },
          update: posted,
        }),
        this.prisma.review.update({ where: { id: review.id }, data: { status: ReviewStatus.PROCESSED } }),
      ]);
      this.logger.log(`Review ${review.id} was replied to on Google directly - marked as replied`);
    }
    return stale.length;
  }

  /**
   * Reconciles a location's reviews against the ids Google still serves:
   * clears the removed flag on any that reappear, and marks as removed any
   * stored review Google no longer returns. Returns how many were newly removed.
   */
  async reconcileRemoved(locationId: string, presentExternalIds: string[]): Promise<number> {
    await this.prisma.review.updateMany({
      where: { locationId, removedAt: { not: null }, externalReviewId: { in: presentExternalIds } },
      data: { removedAt: null },
    });
    const result = await this.prisma.review.updateMany({
      where: { locationId, removedAt: null, externalReviewId: { notIn: presentExternalIds } },
      data: { removedAt: new Date() },
    });
    return result.count;
  }
}
