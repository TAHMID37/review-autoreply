/** Pure helpers that turn reviews into weekly, monthly or yearly report buckets (UTC). */

export type ReportPeriod = "week" | "month" | "year";

export interface ReportReview {
  rating: number;
  reviewedAt: Date;
  locationId: string;
  /** True when a reply has actually been posted on Google. */
  replied: boolean;
}

export interface ReportBucket {
  /** Start of the bucket (UTC): Monday, 1st of the month, or 1 January. */
  start: string;
  label: string;
  total: number;
  /** Null when the bucket has no reviews. */
  averageRating: number | null;
  /** Reviews with 1, 2, 3, 4 and 5 stars. */
  ratingMix: [number, number, number, number, number];
  replied: number;
  /** Percentage replied of the in-scope reviews, null when none are in scope. */
  responseRate: number | null;
}

/** How many buckets each period shows. */
export const BUCKET_COUNT: Record<ReportPeriod, number> = { week: 12, month: 12, year: 5 };

export function bucketStart(date: Date, period: ReportPeriod): Date {
  if (period === "year") return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  if (period === "month") return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const day = (date.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day));
}

export function nextBucketStart(start: Date, period: ReportPeriod): Date {
  if (period === "year") return new Date(Date.UTC(start.getUTCFullYear() + 1, 0, 1));
  if (period === "month") return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 7));
}

function previousBucketStart(start: Date, period: ReportPeriod): Date {
  if (period === "year") return new Date(Date.UTC(start.getUTCFullYear() - 1, 0, 1));
  if (period === "month") return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1));
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() - 7));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function bucketLabel(start: Date, period: ReportPeriod): string {
  if (period === "year") return String(start.getUTCFullYear());
  if (period === "month") return `${MONTHS[start.getUTCMonth()]} ${start.getUTCFullYear()}`;
  return `${start.getUTCDate()} ${MONTHS[start.getUTCMonth()]}`;
}

/** The first moment covered by the report: the start of the oldest bucket. */
export function reportWindowStart(now: Date, period: ReportPeriod): Date {
  let start = bucketStart(now, period);
  for (let i = 1; i < BUCKET_COUNT[period]; i++) start = previousBucketStart(start, period);
  return start;
}

/**
 * Oldest to newest, always `BUCKET_COUNT` buckets ending with the current one,
 * so a quiet period shows as a zero rather than a gap.
 *
 * `responseScopeStart` is the date auto-replies were switched on. Reviews before
 * it are the backlog the system deliberately never answers, so they are left
 * out of the response rate (they still count in the totals). Null = everything.
 */
export function buildBuckets(
  reviews: ReportReview[],
  period: ReportPeriod,
  now: Date,
  responseScopeStart: Date | null,
): ReportBucket[] {
  const starts: Date[] = [];
  let cursor = reportWindowStart(now, period);
  for (let i = 0; i < BUCKET_COUNT[period]; i++) {
    starts.push(cursor);
    cursor = nextBucketStart(cursor, period);
  }

  return starts.map((start) => {
    const end = nextBucketStart(start, period);
    const inBucket = reviews.filter((r) => r.reviewedAt >= start && r.reviewedAt < end);
    const mix: [number, number, number, number, number] = [0, 0, 0, 0, 0];
    for (const r of inBucket) {
      if (r.rating >= 1 && r.rating <= 5) mix[r.rating - 1]++;
    }
    const total = inBucket.length;
    const scoped = responseScopeStart ? inBucket.filter((r) => r.reviewedAt >= responseScopeStart) : inBucket;
    const repliedScoped = scoped.filter((r) => r.replied).length;
    return {
      start: start.toISOString().slice(0, 10),
      label: bucketLabel(start, period),
      total,
      averageRating: total ? round1(inBucket.reduce((sum, r) => sum + r.rating, 0) / total) : null,
      ratingMix: mix,
      replied: inBucket.filter((r) => r.replied).length,
      responseRate: scoped.length ? Math.round((repliedScoped / scoped.length) * 100) : null,
    };
  });
}

/** One CSV row per bucket. Values are numbers or fixed labels, but quote defensively. */
export function bucketsToCsv(buckets: ReportBucket[]): string {
  const header = ["Period start", "Period", "Reviews", "Average rating", "1 star", "2 stars", "3 stars", "4 stars", "5 stars", "Replied", "Response rate %"];
  const rows = buckets.map((b) => [
    b.start,
    b.label,
    b.total,
    b.averageRating ?? "",
    ...b.ratingMix,
    b.replied,
    b.responseRate ?? "",
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
