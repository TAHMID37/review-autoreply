import { Injectable } from "@nestjs/common";
import { CommentCondition } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * The drafting engine, driven entirely by the DB config (response templates +
 * auto-reply rules) so it mirrors Birdeye and is editable from the dashboard.
 *
 * For a review it finds the highest-ranked enabled rule whose rating set and
 * comment condition match, then picks one of that rule's template variants
 * (deterministically per review) and fills in the reviewer's first name.
 *
 * Returns draft = null when NO rule matches (e.g. 1-2 stars with a comment,
 * which Birdeye has no rule for) so the caller holds it for a person.
 */
@Injectable()
export class AutoReplyService {
  constructor(private readonly prisma: PrismaService) {}

  async selectDraft(input: {
    brandId: string;
    rating: number;
    reviewText: string;
    reviewerName: string;
    seed: string;
  }): Promise<AutoReplyResult> {
    const hasComment = (input.reviewText || "").trim().length > 0;

    const rules = await this.prisma.autoReplyRule.findMany({
      where: { brandId: input.brandId, enabled: true },
      orderBy: { rank: "desc" },
    });

    const rule = rules.find(
      (r) => r.ratings.includes(input.rating) && commentMatches(r.comment, hasComment) && r.templateIds.length > 0,
    );

    if (!rule) {
      return {
        draft: null,
        note: "No auto-reply rule matches this review (e.g. 1-2 stars with a comment). Held for a manual reply.",
      };
    }

    // Only choose among the rule's templates that still exist and are enabled,
    // preserving the rule's variant order (A, B, C, D).
    const found = await this.prisma.responseTemplate.findMany({
      where: { id: { in: rule.templateIds }, enabled: true },
    });
    const ordered = rule.templateIds.map((id) => found.find((t) => t.id === id)).filter(isTemplate);

    if (ordered.length === 0) {
      return {
        draft: null,
        ruleName: rule.name,
        note: `Rule "${rule.name}" has no usable template. Held for a manual reply.`,
      };
    }

    const chosen = ordered[pickVariant(input.seed, ordered.length)];
    const draft = fillReviewerName(chosen.body, input.reviewerName);

    return {
      draft,
      ruleName: rule.name,
      templateName: chosen.name,
      delayHours: rule.delayHours,
      autoPostable: true,
    };
  }
}

export interface AutoReplyResult {
  /** The filled reply text, or null when no rule matches (hold for a person). */
  draft: string | null;
  ruleName?: string;
  templateName?: string;
  delayHours?: number;
  /** True when a rule matched: Birdeye would auto-post this after the delay. */
  autoPostable?: boolean;
  /** Why it was held, when draft is null. */
  note?: string;
}

function commentMatches(condition: CommentCondition, hasComment: boolean): boolean {
  if (condition === CommentCondition.PRESENT) return hasComment;
  if (condition === CommentCondition.ABSENT) return !hasComment;
  return true; // ANY
}

/** Replaces Birdeye's ${Reviewer first name} / ${Reviewer name} and our legacy
 *  [Name] placeholder with the reviewer's first name. */
function fillReviewerName(body: string, reviewerName: string): string {
  const first = firstName(reviewerName);
  return body
    .replace(/\$\{Reviewer first name\}/g, first)
    .replace(/\$\{Reviewer name\}/g, first)
    .replace(/\[Name\]/g, first);
}

function firstName(reviewerName: string): string {
  const first = (reviewerName || "").trim().split(/\s+/)[0]?.replace(/[^A-Za-z'-]/g, "");
  return first && first.length > 0 ? first : "there";
}

/** Stable pick so the same review always maps to the same variant. */
function pickVariant(seed: string, count: number): number {
  if (count <= 1) return 0;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % count;
}

function isTemplate<T>(value: T | undefined): value is T {
  return value !== undefined;
}
