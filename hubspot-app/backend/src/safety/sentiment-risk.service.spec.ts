import { RiskLevel } from "@prisma/client";
import { SentimentRiskService } from "./sentiment-risk.service";

/**
 * This service decides whether a reply is published to a public Google review
 * without a human ever seeing it. A regression here is not a cosmetic bug —
 * it could auto-reply to a refund demand or a legal threat, so the routing
 * rules are pinned down here.
 */
describe("SentimentRiskService", () => {
  const service = new SentimentRiskService();

  describe("auto-replies only genuinely safe reviews", () => {
    it.each([
      [5, "Did my forklift licence here and passed first go. The instructor was clear and patient."],
      [5, "Booked the White Card course online and finished in a day. Simple process, friendly staff."],
      [4, "Good training and useful content. Parking was a bit tight but that's minor."],
    ])("routes a %i-star review with no sensitive content to LOW risk", (rating, text) => {
      expect(service.assess(rating, text).riskLevel).toBe(RiskLevel.LOW);
    });
  });

  describe("holds low ratings for a human", () => {
    it.each([[3], [2], [1]])("routes a %i-star review to HIGH risk", (rating) => {
      const result = service.assess(rating, "The training was okay.");
      expect(result.riskLevel).toBe(RiskLevel.HIGH);
      expect(result.riskFlags).toContain("low_rating");
    });
  });

  describe("catches sensitive content that the star rating hides", () => {
    // The proposal calls this out explicitly: a 5-star review can still
    // contain a complaint, so rating alone must never decide routing.
    it.each([
      ["staff_conduct", "Great course overall, but one of the staff was extremely rude to me."],
      ["legal_threat", "Good place but I am speaking to my lawyer about this."],
      ["refund_request", "Loved the trainer but I still want a refund for the second day."],
      ["safety", "Good content, though the equipment felt genuinely unsafe."],
      ["discrimination", "Trainer was fine but another student was harassed and nothing happened."],
      ["fraud_allegation", "Nice building, but the pricing is misleading."],
    ])("flags %s even on a 5-star review", (expectedFlag, text) => {
      const result = service.assess(5, text);
      expect(result.riskLevel).toBe(RiskLevel.HIGH);
      expect(result.riskFlags).toContain(expectedFlag);
    });
  });

  it("explains why a review was held, so staff aren't guessing", () => {
    const result = service.assess(1, "I want a refund.");
    expect(result.reason).toBeTruthy();
    expect(result.riskFlags.length).toBeGreaterThan(0);
  });

  it("classifies sentiment from the rating", () => {
    expect(service.assess(5, "Great").sentiment).toBe("positive");
    expect(service.assess(3, "Okay").sentiment).toBe("neutral");
    expect(service.assess(1, "Bad").sentiment).toBe("negative");
  });
});
