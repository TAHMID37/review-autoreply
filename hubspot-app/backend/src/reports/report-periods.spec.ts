import { bucketLabel, bucketsToCsv, bucketStart, buildBuckets, BUCKET_COUNT, ReportReview } from "./report-periods";

const r = (iso: string, rating: number, replied = false, locationId = "l1"): ReportReview => ({
  rating,
  replied,
  locationId,
  reviewedAt: new Date(iso),
});

describe("report buckets", () => {
  it("starts weeks on Monday (UTC)", () => {
    expect(bucketStart(new Date("2026-11-09T10:00:00Z"), "week").toISOString()).toBe("2026-11-09T00:00:00.000Z");
    expect(bucketStart(new Date("2026-11-08T23:00:00Z"), "week").toISOString()).toBe("2026-11-02T00:00:00.000Z");
  });

  it("always returns the full number of buckets, newest last, with quiet periods as zero", () => {
    const now = new Date("2026-11-09T10:00:00Z");
    for (const p of ["week", "month", "year"] as const) {
      const buckets = buildBuckets([], p, now, null);
      expect(buckets).toHaveLength(BUCKET_COUNT[p]);
      expect(buckets.at(-1)!.total).toBe(0);
      expect(buckets.at(-1)!.averageRating).toBeNull();
    }
  });

  it("counts rating mix, average and replies per month", () => {
    const now = new Date("2026-11-09T10:00:00Z");
    const reviews = [r("2026-11-02T00:00:00Z", 5, true), r("2026-11-05T00:00:00Z", 1), r("2026-10-30T00:00:00Z", 4, true)];
    const [oct, nov] = buildBuckets(reviews, "month", now, null).slice(-2);
    expect(oct).toMatchObject({ label: "Oct 2026", total: 1, averageRating: 4, replied: 1, responseRate: 100 });
    expect(nov).toMatchObject({ label: "Nov 2026", total: 2, averageRating: 3, ratingMix: [1, 0, 0, 0, 1], replied: 1, responseRate: 50 });
  });

  it("leaves reviews before go-live out of the response rate but not the totals", () => {
    const now = new Date("2026-11-09T10:00:00Z");
    const reviews = [r("2026-11-02T00:00:00Z", 5), r("2026-11-06T00:00:00Z", 5, true)];
    const nov = buildBuckets(reviews, "month", now, new Date("2026-11-05T00:00:00Z")).at(-1)!;
    expect(nov.total).toBe(2);
    expect(nov.responseRate).toBe(100);
  });

  it("labels buckets", () => {
    expect(bucketLabel(new Date("2026-11-09T00:00:00Z"), "week")).toBe("9 Nov");
    expect(bucketLabel(new Date("2026-01-01T00:00:00Z"), "year")).toBe("2026");
  });

  it("writes a CSV with a header and one row per bucket", () => {
    const csv = bucketsToCsv(buildBuckets([r("2026-11-05T00:00:00Z", 5, true)], "year", new Date("2026-11-09T00:00:00Z"), null));
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe("Period start,Period,Reviews,Average rating,1 star,2 stars,3 stars,4 stars,5 stars,Replied,Response rate %");
    expect(lines).toHaveLength(1 + BUCKET_COUNT.year);
    expect(lines.at(-1)).toBe("2026-01-01,2026,1,5,0,0,0,0,1,1,100");
  });
});
