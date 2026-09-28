import { hasOwnerReply, mapReview } from "./google-reviews.client";
import { splitResource } from "./reviews-sync.service";

describe("mapReview", () => {
  it("maps a Google v4 review to the ingestion shape", () => {
    const out = mapReview({
      reviewId: "abc123",
      reviewer: { displayName: "Sarah M." },
      starRating: "FIVE",
      comment: "Great course",
      createTime: "2026-09-10T02:00:00Z",
    });
    expect(out).toEqual({
      externalReviewId: "abc123",
      reviewerName: "Sarah M.",
      rating: 5,
      reviewText: "Great course",
      reviewedAt: new Date("2026-09-10T02:00:00Z"),
    });
  });

  it("handles a rating-only review with no comment or name", () => {
    const out = mapReview({ reviewId: "r2", starRating: "THREE" });
    expect(out?.rating).toBe(3);
    expect(out?.reviewText).toBe("");
    expect(out?.reviewerName).toBe("Anonymous");
  });

  it("returns null when the rating or id is missing", () => {
    expect(mapReview({ reviewId: "r3" })).toBeNull();
    expect(mapReview({ starRating: "FIVE" })).toBeNull();
  });
});

describe("hasOwnerReply", () => {
  it("is true when a reply with a comment exists (already answered by us)", () => {
    expect(hasOwnerReply({ reviewId: "r1", starRating: "FIVE", reviewReply: { comment: "Thanks!" } })).toBe(true);
  });

  it("is true when a reply has only an updateTime", () => {
    expect(hasOwnerReply({ reviewId: "r1", reviewReply: { updateTime: "2026-09-01T00:00:00Z" } })).toBe(true);
  });

  it("is false when there is no reply (unanswered - safe to pull)", () => {
    expect(hasOwnerReply({ reviewId: "r1", starRating: "FIVE", comment: "Great" })).toBe(false);
    expect(hasOwnerReply({ reviewId: "r1", reviewReply: { comment: "   " } })).toBe(false);
  });
});

describe("splitResource", () => {
  it("splits a full location resource", () => {
    expect(splitResource("accounts/123/locations/456")).toEqual({
      accountName: "accounts/123",
      locationName: "locations/456",
    });
  });

  it("rejects a malformed resource", () => {
    expect(() => splitResource("locations/456")).toThrow();
  });
});
