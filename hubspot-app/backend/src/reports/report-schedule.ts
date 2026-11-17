import { bucketStart, ReportPeriod } from "./report-periods";

export type ScheduledFrequency = "WEEKLY" | "MONTHLY";

const PERIOD_OF: Record<ScheduledFrequency, ReportPeriod> = { WEEKLY: "week", MONTHLY: "month" };

export function periodOf(frequency: ScheduledFrequency): ReportPeriod {
  return PERIOD_OF[frequency];
}

/**
 * A report is due once a new week (Monday) or month (the 1st) has started since
 * the last one went out. It then covers the period that has just finished.
 * `lastSentAt` is set when reports are switched on, so nothing is sent early.
 */
export function isReportDue(frequency: ScheduledFrequency, lastSentAt: Date | null, now: Date): boolean {
  const currentStart = bucketStart(now, PERIOD_OF[frequency]);
  return lastSentAt === null || lastSentAt < currentStart;
}
