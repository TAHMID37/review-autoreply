import { CommentCondition, Prisma } from "@prisma/client";

/**
 * The starter templates and auto-reply rules every new business gets on
 * install, so auto-replies work out of the box. Each business can edit, add or
 * delete them from the Templates and Rules screens afterwards.
 *
 * Mirrors the plan's policy: 4-hour delay for 1-2 stars, 24 hours for 3-5.
 * There is deliberately NO rule for 1-2 stars with a comment - those always
 * wait for a person (and the processor enforces that even if a business adds
 * such a rule itself).
 */
interface TemplateSeed {
  name: string;
  body: string;
}

interface RuleSeed {
  name: string;
  ratings: number[];
  comment: CommentCondition;
  delayHours: number;
  templates: string[];
  rank: number;
}

const SIGN_OFF = "\n\nThe ${Business name} team";

export const DEFAULT_TEMPLATES: TemplateSeed[] = [
  {
    name: "Positive with comment - A",
    body: "Thank you so much, ${Reviewer first name}! We're thrilled you had a great experience and really appreciate you taking the time to share it. We look forward to seeing you again soon." + SIGN_OFF,
  },
  {
    name: "Positive with comment - B",
    body: "${Reviewer first name}, thank you for the wonderful review! Feedback like yours means a lot to our team, and we're so glad we could help." + SIGN_OFF,
  },
  {
    name: "Positive without comment - A",
    body: "Thank you for the great rating, ${Reviewer first name}! We really appreciate your support." + SIGN_OFF,
  },
  {
    name: "Positive without comment - B",
    body: "${Reviewer first name}, thanks so much for taking the time to rate us. It means a lot to the whole team." + SIGN_OFF,
  },
  {
    name: "Neutral - A",
    body: "Thank you for your feedback, ${Reviewer first name}. We're always looking for ways to improve, and we'd love the chance to give you an even better experience next time." + SIGN_OFF,
  },
  {
    name: "Negative without comment - A",
    body: "${Reviewer first name}, thank you for your rating. We're sorry we didn't meet your expectations. If you're happy to share more about your experience, please get in touch with us directly so we can make it right." + SIGN_OFF,
  },
];

export const DEFAULT_RULES: RuleSeed[] = [
  {
    name: "4-5 stars with comment",
    ratings: [4, 5],
    comment: CommentCondition.PRESENT,
    delayHours: 24,
    templates: ["Positive with comment - A", "Positive with comment - B"],
    rank: 40,
  },
  {
    name: "4-5 stars without comment",
    ratings: [4, 5],
    comment: CommentCondition.ABSENT,
    delayHours: 24,
    templates: ["Positive without comment - A", "Positive without comment - B"],
    rank: 30,
  },
  {
    name: "3 stars",
    ratings: [3],
    comment: CommentCondition.ANY,
    delayHours: 24,
    templates: ["Neutral - A"],
    rank: 20,
  },
  {
    name: "1-2 stars without comment",
    ratings: [1, 2],
    comment: CommentCondition.ABSENT,
    delayHours: 4,
    templates: ["Negative without comment - A"],
    rank: 10,
  },
];

/** Creates the starter templates + rules for a business that has none yet.
 *  Never overwrites a business's own edits. */
export async function seedDefaultReplyConfig(tx: Prisma.TransactionClient, brandId: string): Promise<void> {
  const existing = await tx.responseTemplate.count({ where: { brandId } });
  if (existing > 0) return;

  const idByName = new Map<string, string>();
  for (const t of DEFAULT_TEMPLATES) {
    const created = await tx.responseTemplate.create({ data: { brandId, name: t.name, body: t.body } });
    idByName.set(t.name, created.id);
  }
  for (const r of DEFAULT_RULES) {
    await tx.autoReplyRule.create({
      data: {
        brandId,
        name: r.name,
        ratings: r.ratings,
        comment: r.comment,
        delayHours: r.delayHours,
        rank: r.rank,
        templateIds: r.templates.map((n) => idByName.get(n)!),
      },
    });
  }
}
