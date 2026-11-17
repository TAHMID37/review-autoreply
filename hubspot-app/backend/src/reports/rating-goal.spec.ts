import { calculateRatingGoal } from "./rating-goal";

describe("calculateRatingGoal", () => {
  it("works out the 5-star reviews needed with the rounded target", () => {
    // 100 reviews at 4.3, target 4.5 -> effective 4.45. gap = 4.45*100 - 430 = 15. k = 15 / 0.55 = 27.27 -> 28
    const r = calculateRatingGoal({ average: 4.3, total: 100, target: 4.5 });
    expect(r.effectiveTarget).toBe(4.45);
    expect(r.fiveStarNeeded).toBe(28);
    expect(r.alreadyReached).toBe(false);
  });

  it("works out the 1-star removals needed", () => {
    // gap 15, m = 15 / (4.45 - 1) = 4.35 -> 5
    expect(calculateRatingGoal({ average: 4.3, total: 100, target: 4.5 }).oneStarRemovals).toBe(5);
  });

  it("uses the exact target when rounding is switched off", () => {
    // gap = 4.5*100 - 430 = 20, k = 20 / 0.5 = 40 exactly (no float noise bump to 41)
    const r = calculateRatingGoal({ average: 4.3, total: 100, target: 4.5, roundedTarget: false });
    expect(r.fiveStarNeeded).toBe(40);
  });

  it("says zero when the target is already reached", () => {
    const r = calculateRatingGoal({ average: 4.6, total: 50, target: 4.5 });
    expect(r).toMatchObject({ alreadyReached: true, fiveStarNeeded: 0, oneStarRemovals: 0 });
  });

  it("reports a perfect 5.0 target as not reachable by adding 5-star reviews", () => {
    const r = calculateRatingGoal({ average: 4.8, total: 100, target: 5, roundedTarget: false });
    expect(r.fiveStarNeeded).toBeNull();
  });

  it("rejects impossible inputs", () => {
    expect(() => calculateRatingGoal({ average: 4.3, total: 100, target: 5.5 })).toThrow(RangeError);
    expect(() => calculateRatingGoal({ average: 0, total: 100, target: 4.5 })).toThrow(RangeError);
  });
});
