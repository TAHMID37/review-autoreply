import { Inject, Injectable } from "@nestjs/common";
import { Prisma, ReplyStatus } from "@prisma/client";
import { Env } from "../config/env.schema";
import { APP_ENV } from "../config/env.token";
import { PrismaService } from "../common/prisma/prisma.service";
import { GOOGLE_OWNER_PROVIDER } from "../reviews/reviews.service";

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

export interface WeeklyVolume {
  week: string;
  replied: number;
  pending: number;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_ENV) private readonly env: Env,
  ) {}

  /** The four stat tiles at the top of the dashboard. */
  async getStats(brandId?: string): Promise<ReviewStats> {
    const where: Prisma.ReviewWhereInput = brandId ? { location: { brandId } } : {};
    const monthStart = startOfCurrentMonth();

    // Response rate is measured only against the reviews this system is actually
    // responsible for: those on or after the go-live cutoff. The older backlog is
    // deliberately never auto-replied (see AUTO_POST_MIN_REVIEW_DATE), so counting
    // it in the denominator would pin the rate near zero forever and read as a
    // failure rather than the policy it is. With no cutoff set, scope is everything.
    const cutoff = this.env.AUTO_POST_MIN_REVIEW_DATE;
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

  /** Reviews per week for the last 4 weeks — the bar chart on the report. */
  async getWeeklyVolume(brandId?: string): Promise<WeeklyVolume[]> {
    const where: Prisma.ReviewWhereInput = brandId ? { location: { brandId } } : {};
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
