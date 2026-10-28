import type { ReviewStats } from "@/types/api";

/**
 * The one-line working shown under the Response rate tile.
 *
 * The rate is deliberately measured against reviews from the go-live cutoff
 * onwards, not the whole historical backlog, so the tile spells out which
 * reviews it counted. Without that line a high percentage over a small
 * denominator looks like a claim about every review ever received.
 */
export function responseScopeLabel(stats: ReviewStats): string {
  const { posted, total, sinceCutoff } = stats.responseScope;
  const noun = total === 1 ? "review" : "reviews";
  return sinceCutoff ? `${posted} of ${total} ${noun} since go-live` : `${posted} of ${total} ${noun}`;
}
