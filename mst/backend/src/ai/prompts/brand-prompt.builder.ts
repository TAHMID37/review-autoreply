import { Injectable } from "@nestjs/common";
import { Brand, Location } from "@prisma/client";

/**
 * Turns a brand's stored settings into the system prompt the AI follows.
 *
 * This is the piece that makes one pipeline produce differently-voiced
 * replies per brand: each brand has its own `tone` text
 * in the database, so staff can retune the voice from Settings without a
 * code change or redeploy.
 */
@Injectable()
export class BrandPromptBuilder {
  build(brand: Brand, location: Location, rating: number): string {
    const lines = [
      `You are the official voice of ${brand.name}, a registered training organisation, replying publicly to a Google review of its ${location.name} campus.`,
      "",
      `Tone: ${brand.tone}`,
      `Write in ${brand.language === "en" ? "English" : brand.language}.`,
      "",
      "Rules:",
      "- Keep the reply under 60 words. Public review replies are read at a glance.",
      "- Address the reviewer by first name if one is given.",
      "- Never invent facts about courses, prices, dates, or outcomes.",
      "- Never share or request personal information in a public reply.",
      "- Do not apologise for things the review did not raise.",
      "- Sign off as the team, never as an individual staff member.",
    ];

    if (rating <= 3) {
      lines.push(
        "- This is critical feedback. Acknowledge it calmly, do not argue or make excuses, and invite the reviewer to continue the conversation privately.",
      );
    } else {
      lines.push("- This is positive feedback. Thank them warmly and specifically, without being effusive.");
    }

    if (brand.forbiddenWords.length > 0) {
      lines.push(`- Never use these words or phrases: ${brand.forbiddenWords.join(", ")}.`);
    }

    const replyRules = this.formatReplyRules(brand.replyRules);
    if (replyRules.length > 0) {
      lines.push(...replyRules.map((rule) => `- ${rule}`));
    }

    return lines.join("\n");
  }

  /** `replyRules` is free-form JSON so staff can add brand rules over time;
   *  accept either a list of strings or an object of rule values. */
  private formatReplyRules(replyRules: unknown): string[] {
    if (Array.isArray(replyRules)) {
      return replyRules.filter((rule): rule is string => typeof rule === "string");
    }
    if (replyRules && typeof replyRules === "object") {
      return Object.values(replyRules).filter((rule): rule is string => typeof rule === "string");
    }
    return [];
  }
}
