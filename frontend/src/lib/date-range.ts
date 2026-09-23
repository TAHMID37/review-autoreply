export type DateRange = "all" | "today" | "7d" | "30d";

export const DATE_RANGE_LABEL: Record<DateRange, string> = {
  all: "All time",
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
};

export const DATE_RANGES = Object.keys(DATE_RANGE_LABEL) as DateRange[];

/** True if `iso` falls within the selected recency window. */
export function withinRange(iso: string, range: DateRange): boolean {
  if (range === "all") return true;
  const t = new Date(iso).getTime();
  if (range === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return t >= start.getTime();
  }
  const days = range === "7d" ? 7 : 30;
  return t >= Date.now() - days * 24 * 60 * 60 * 1000;
}
