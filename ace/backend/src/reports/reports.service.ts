import { Injectable } from "@nestjs/common";
import { Prisma, ReplyStatus } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";

export interface ReviewStats {
  averageRating: number;
  reviewsThisMonth: number;
  /** Percentage of reviews that have a reply actually posted. */
  responseRate: number;
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
  constructor(private readonly prisma: PrismaService) {}

  /** The four stat tiles at the top of the dashboard. */
  async getStats(brandId?: string): Promise<ReviewStats> {
    const where: Prisma.ReviewWhereInput = brandId ? { location: { brandId } } : {};
    const monthStart = startOfCurrentMonth();

    const [aggregate, totalReviews, reviewsThisMonth, postedCount, autoRepliedCount, needsApprovalCount] =
      await Promise.all([
        this.prisma.review.aggregate({ where, _avg: { rating: true } }),
        this.prisma.review.count({ where }),
        this.prisma.review.count({ where: { ...where, reviewedAt: { gte: monthStart } } }),
        this.prisma.review.count({ where: { ...where, reply: { status: ReplyStatus.POSTED } } }),
        this.prisma.review.count({
          where: { ...where, reply: { status: ReplyStatus.POSTED, approvedByUserId: null } },
        }),
        this.prisma.review.count({ where: { ...where, reply: { status: ReplyStatus.PENDING_APPROVAL } } }),
      ]);

    return {
      averageRating: round(aggregate._avg.rating ?? 0, 1),
      reviewsThisMonth,
      responseRate: totalReviews === 0 ? 0 : Math.round((postedCount / totalReviews) * 100),
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
