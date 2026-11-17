/**
 * Rating goal calculator. S = sum of ratings, n = review count, T = target.
 *
 *   5-star reviews needed:        k = ceil((T*n - S) / (5 - T))
 *   1-star reviews to be removed: m = ceil((T*n - S) / (T - 1))
 *
 * Google shows one decimal, so a 4.5 target is really reached at about 4.45;
 * by default the target is shifted down by 0.05 to match what Google displays.
 * `average` and `total` should be Google's own figures for the location (they
 * include ratings left without text), not our synced copy.
 */

export interface RatingGoalInput {
  /** Google's current average rating for the location. */
  average: number;
  /** Google's total review count for the location. */
  total: number;
  /** The rating the business wants to reach, e.g. 4.5. */
  target: number;
  /** Treat the target as reached once Google would display it (default true). */
  roundedTarget?: boolean;
}

export interface RatingGoalResult {
  /** The target actually used after rounding (target - 0.05 when roundedTarget). */
  effectiveTarget: number;
  alreadyReached: boolean;
  /** New 5-star reviews needed. Null when the target cannot be reached this way (target is 5). */
  fiveStarNeeded: number | null;
  /** 1-star reviews that would have to be removed. Null when the target is 5 or more. */
  oneStarRemovals: number | null;
}

export function calculateRatingGoal(input: RatingGoalInput): RatingGoalResult {
  const { average, total, target } = input;
  if (!(average >= 1 && average <= 5) || !Number.isFinite(total) || total < 0) {
    throw new RangeError("Average must be 1 to 5 and total must be 0 or more");
  }
  if (!(target > 1 && target <= 5)) {
    throw new RangeError("Target must be above 1 and no more than 5");
  }

  const effectiveTarget = input.roundedTarget === false ? target : round2(target - 0.05);
  const sum = average * total;
  const gap = effectiveTarget * total - sum;

  if (gap <= 0) {
    return { effectiveTarget, alreadyReached: true, fiveStarNeeded: 0, oneStarRemovals: 0 };
  }
  return {
    effectiveTarget,
    alreadyReached: false,
    // A perfect 5.0 can never be reached by adding 5-star reviews (and removing
    // 1-stars only works if every low rating can be removed): report "not possible".
    fiveStarNeeded: effectiveTarget >= 5 ? null : ceilSafe(gap / (5 - effectiveTarget)),
    oneStarRemovals: effectiveTarget <= 1 ? null : ceilSafe(gap / (effectiveTarget - 1)),
  };
}

/** Float noise (e.g. 3.0000000000000004) must not tip a whole number up by one. */
function ceilSafe(value: number): number {
  return Math.ceil(Math.round(value * 1e9) / 1e9);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
