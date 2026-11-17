import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma, ReplyStatus } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { GOOGLE_OWNER_PROVIDER } from "../reviews/reviews.service";
import { calculateRatingGoal, RatingGoalResult } from "./rating-goal";
import { buildBuckets, bucketsToCsv, bucketStart, ReportBucket, ReportPeriod, reportWindowStart } from "./report-periods";

export interface ReviewStats {
  averageRating: number;
  reviewsThisMonth: number;
  /** Percentage of in-scope reviews that have a reply actually posted. */
  responseRate: number;
  /** The numerator/denominator behind responseRate, so the UI can show its working. */
  responseScope: { posted: number; total: number; sinceCutoff: boolean };
  autoRepliedCount: number;
  needsApprovalCount: number;
  totalReviews: number;
}

export interface PeriodReport {
  period: ReportPeriod;
  /** Oldest to newest; the last one is the current (still running) period. */
  buckets: ReportBucket[];
  /** The current period, split by location. */
  byLocation: { locationId: string; name: string; total: number; averageRating: number | null }[];
}

export interface RatingGoalReport extends RatingGoalResult {
  target: number;
  currentAverage: number;
  totalReviews: number;
  /** "google" = Google's own figures (preferred); "synced" = our copy, used until a first sync stores them. */
  source: "google" | "synced";
  scope: string;
}

export interface WeeklyVolume {
  week: string;
  replied: number;
  pending: number;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The four stat tiles at the top of the dashboard. */
  async getStats(brandId: string): Promise<ReviewStats> {
    const where: Prisma.ReviewWhereInput = { location: { brandId }, removedAt: null };
    const monthStart = startOfCurrentMonth();

    // Response rate is measured only against the reviews this system is actually
    // responsible for: those left after the business switched auto-replies on.
    // The older backlog is deliberately never auto-replied, so counting it would
    // pin the rate near zero and read as a failure rather than the policy it is.
    // Before auto-replies are switched on, scope is everything.
    const brand = await this.prisma.brand.findUniqueOrThrow({ where: { id: brandId }, select: { autoReplyStartAt: true } });
    const cutoff = brand.autoReplyStartAt;
    const inScope: Prisma.ReviewWhereInput = cutoff ? { ...where, reviewedAt: { gte: cutoff } } : where;

    const [aggregate, totalReviews, reviewsThisMonth, scopeTotal, scopePosted, autoRepliedCount, needsApprovalCount] =
      await Promise.all([
        this.prisma.review.aggregate({ where, _avg: { rating: true } }),
        this.prisma.review.count({ where }),
        this.prisma.review.count({ where: { ...where, reviewedAt: { gte: monthStart } } }),
        this.prisma.review.count({ where: inScope }),
        this.prisma.review.count({ where: { ...inScope, reply: { status: ReplyStatus.POSTED } } }),
        this.prisma.review.count({
          // Replies posted on Google by hand are responses, but not auto-replies.
          where: {
            ...where,
            reply: { status: ReplyStatus.POSTED, approvedByUserId: null, aiProvider: { not: GOOGLE_OWNER_PROVIDER } },
          },
        }),
        this.prisma.review.count({ where: { ...where, reply: { status: ReplyStatus.PENDING_APPROVAL } } }),
      ]);

    return {
      averageRating: round(aggregate._avg.rating ?? 0, 1),
      reviewsThisMonth,
      responseRate: scopeTotal === 0 ? 0 : Math.round((scopePosted / scopeTotal) * 100),
      responseScope: { posted: scopePosted, total: scopeTotal, sinceCutoff: Boolean(cutoff) },
      autoRepliedCount,
      needsApprovalCount,
      totalReviews,
    };
  }

  /** Weekly, monthly or yearly report, optionally for one location. */
  async getPeriodReport(brandId: string, period: ReportPeriod, locationId?: string, now = new Date()): Promise<PeriodReport> {
    if (locationId) await this.assertLocation(brandId, locationId);
    const brand = await this.prisma.brand.findUniqueOrThrow({ where: { id: brandId }, select: { autoReplyStartAt: true } });
    const rows = await this.prisma.review.findMany({
      where: {
        removedAt: null,
        location: { brandId, ...(locationId ? { id: locationId } : {}) },
        reviewedAt: { gte: reportWindowStart(now, period) },
      },
      select: { rating: true, reviewedAt: true, locationId: true, reply: { select: { status: true } }, location: { select: { name: true } } },
    });
    const reviews = rows.map((r) => ({
      rating: r.rating,
      reviewedAt: r.reviewedAt,
      locationId: r.locationId,
      replied: r.reply?.status === ReplyStatus.POSTED,
    }));
    const buckets = buildBuckets(reviews, period, now, brand.autoReplyStartAt);

    const currentStart = bucketStart(now, period);
    const names = new Map(rows.map((r) => [r.locationId, r.location.name]));
    const current = new Map<string, number[]>();
    for (const r of reviews) {
      if (r.reviewedAt >= currentStart) current.set(r.locationId, [...(current.get(r.locationId) ?? []), r.rating]);
    }
    const byLocation = [...current.entries()]
      .map(([id, ratings]) => ({
        locationId: id,
        name: names.get(id) ?? "",
        total: ratings.length,
        averageRating: round(ratings.reduce((a, b) => a + b, 0) / ratings.length, 1),
      }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

    return { period, buckets, byLocation };
  }

  async getPeriodCsv(brandId: string, period: ReportPeriod, locationId?: string): Promise<string> {
    return bucketsToCsv((await this.getPeriodReport(brandId, period, locationId)).buckets);
  }

  /**
   * How far a location (or all synced locations together) is from a target
   * rating. Uses Google's own average and total, which include ratings left
   * without text; falls back to our synced copy until a first sync stores them.
   */
  async getRatingGoal(brandId: string, target: number, locationId?: string, roundedTarget = true): Promise<RatingGoalReport> {
    if (locationId) await this.assertLocation(brandId, locationId);
    const locations = await this.prisma.location.findMany({
      where: { brandId, syncEnabled: true, ...(locationId ? { id: locationId } : {}) },
      select: { id: true, name: true, googleAverageRating: true, googleTotalReviews: true },
    });

    let sum = 0;
    let total = 0;
    let source: "google" | "synced" = "google";
    for (const l of locations) {
      if (l.googleAverageRating !== null && l.googleTotalReviews) {
        sum += l.googleAverageRating * l.googleTotalReviews;
        total += l.googleTotalReviews;
      } else {
        // No Google figures yet for this location: use what we have synced.
        source = "synced";
        const agg = await this.prisma.review.aggregate({
          where: { locationId: l.id, removedAt: null },
          _sum: { rating: true },
          _count: true,
        });
        sum += agg._sum.rating ?? 0;
        total += agg._count;
      }
    }
    if (total === 0) {
      throw new BadRequestException("There are no reviews yet to work from. Sync reviews first.");
    }

    const average = sum / total;
    try {
      const result = calculateRatingGoal({ average, total, target, roundedTarget });
      return {
        ...result,
        target,
        currentAverage: round(average, 2),
        totalReviews: total,
        source,
        scope: locationId ? (locations[0]?.name ?? "") : locations.length === 1 ? locations[0].name : `All ${locations.length} locations`,
      };
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Invalid target");
    }
  }

  private async assertLocation(brandId: string, locationId: string): Promise<void> {
    const found = await this.prisma.location.findFirst({ where: { id: locationId, brandId }, select: { id: true } });
    if (!found) throw new BadRequestException("Unknown location");
  }

  /** Reviews per week for the last 4 weeks — the bar chart on the report. */
  async getWeeklyVolume(brandId: string): Promise<WeeklyVolume[]> {
    const where: Prisma.ReviewWhereInput = { location: { brandId }, removedAt: null };
    const weeks: WeeklyVolume[] = [];

    for (let weeksAgo = 3; weeksAgo >= 0; weeksAgo--) {
      const from = daysAgo(7 * (weeksAgo + 1));
      const to = daysAgo(7 * weeksAgo);

      const [replied, pending] = await Promise.all([
        this.prisma.review.count({
          where: { ...where, reviewedAt: { gte: from, lt: to }, reply: { status: ReplyStatus.POSTED } },
        }),
        this.prisma.review.count({
          where: {
            ...where,
            reviewedAt: { gte: from, lt: to },
            reply: { status: ReplyStatus.PENDING_APPROVAL },
          },
        }),
      ]);

      weeks.push({ week: `W${4 - weeksAgo}`, replied, pending });
    }

    return weeks;
  }
}

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
