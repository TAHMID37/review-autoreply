import { Injectable } from "@nestjs/common";
import { RiskLevel } from "@prisma/client";

export interface RiskAssessment {
  sentiment: "positive" | "neutral" | "negative";
  riskLevel: RiskLevel;
  riskFlags: string[];
  /** Plain-English reason, shown to staff so an approval request is never a mystery. */
  reason: string;
}

/** Star rating at or below which a reply always needs human approval. */
const APPROVAL_RATING_THRESHOLD = 3;

/**
 * Phrases that force human approval regardless of star rating.
 *
 * Rating alone is not enough: the proposal calls this out directly with the
 * example "Great course, but the staff was extremely rude" — five stars, but
 * absolutely not something to auto-reply to. These catch the cases where the
 * rating and the actual content disagree.
 */
const RISK_PATTERNS: { flag: string; pattern: RegExp }[] = [
  { flag: "legal_threat", pattern: /\b(lawyer|solicitor|legal action|sue|court|ombudsman|tribunal)\b/i },
  { flag: "refund_request", pattern: /\b(refund|money back|reimburse|charge ?back|compensation)\b/i },
  { flag: "regulatory", pattern: /\b(asqa|fair trading|accc|complaint to|report(ed)? (them|you) to)\b/i },
  { flag: "discrimination", pattern: /\b(racist|discriminat\w*|harass\w*|bullied|bullying)\b/i },
  { flag: "safety", pattern: /\b(unsafe|injur\w*|accident|dangerous|hazard\w*)\b/i },
  { flag: "staff_conduct", pattern: /\b(rude|disrespectful|unprofessional|ignored|abusive|shouted)\b/i },
  { flag: "fraud_allegation", pattern: /\b(scam|fraud|rip[- ]?off|stole|dishonest|misleading)\b/i },
  { flag: "certification_issue", pattern: /\b(certificate|statement of attainment|usi)\b.{0,40}\b(not|never|still|waiting|delay)\b/i },
];

/**
 * Decides whether a review's reply is safe to post automatically.
 *
 * Deliberately rule-based rather than an AI classification call: the routing
 * decision is the system's main safety control, so it needs to be
 * deterministic, auditable and testable. An AI call here could silently
 * change behaviour between runs on identical input.
 */
@Injectable()
export class SentimentRiskService {
  assess(rating: number, reviewText: string): RiskAssessment {
    const riskFlags = RISK_PATTERNS.filter(({ pattern }) => pattern.test(reviewText)).map(({ flag }) => flag);
    const sentiment = this.classifySentiment(rating);

    if (riskFlags.length > 0) {
      return {
        sentiment,
        riskLevel: RiskLevel.HIGH,
        riskFlags,
        reason: `Review mentions a sensitive topic (${riskFlags.join(", ")}) and needs a person to reply.`,
      };
    }

    if (rating <= APPROVAL_RATING_THRESHOLD) {
      return {
        sentiment,
        riskLevel: RiskLevel.HIGH,
        riskFlags: ["low_rating"],
        reason: `${rating}-star review — held for approval because it is at or below ${APPROVAL_RATING_THRESHOLD} stars.`,
      };
    }

    return {
      sentiment,
      riskLevel: RiskLevel.LOW,
      riskFlags: [],
      reason: `${rating}-star review with no sensitive content — safe to auto-reply.`,
    };
  }

  private classifySentiment(rating: number): RiskAssessment["sentiment"] {
    if (rating >= 4) return "positive";
    if (rating === 3) return "neutral";
    return "negative";
  }
}
