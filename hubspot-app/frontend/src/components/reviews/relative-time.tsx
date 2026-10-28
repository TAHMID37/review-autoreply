const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "2 min ago" / "3 hr ago" / "5 days ago" — matches how the mockup reads. */
export function formatRelativeTime(isoDate: string): string {
  const elapsed = Date.now() - new Date(isoDate).getTime();

  if (elapsed < HOUR) {
    return `${Math.max(1, Math.floor(elapsed / MINUTE))} min ago`;
  }
  if (elapsed < DAY) {
    return `${Math.floor(elapsed / HOUR)} hr ago`;
  }
  const days = Math.floor(elapsed / DAY);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

/** Exact local date and time, e.g. "21 Sep 2026, 2:15 PM". */
export function formatDateTime(isoDate: string): string {
  return new Date(isoDate).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
