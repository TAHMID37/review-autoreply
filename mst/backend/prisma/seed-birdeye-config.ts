import { PrismaClient } from "@prisma/client";
import { APP_BRAND } from "../src/config/app-brand";

/**
 * Seeds the exact Birdeye auto-reply configuration (captured 22 Sep 2026 from
 * the client's live account, authored by Larissa Tan). See docs/birdeye-export.md.
 *
 * Bodies are stored WITH Birdeye's paragraph line breaks (\n\n between
 * paragraphs, \n before the signature) so posted replies match Birdeye exactly.
 * The ${Reviewer first name} / ${Reviewer name} placeholder is kept verbatim;
 * the drafting engine fills in the reviewer's first name.
 *
 * This deployment is single-brand, so only MST's config lives here.
 * Idempotent: clears this brand's templates + rules and recreates them.
 */
const prisma = new PrismaClient();

type Comment = "PRESENT" | "ABSENT" | "ANY";

interface TemplateSeed {
  name: string;
  body: string;
}
interface RuleSeed {
  name: string;
  ratings: number[];
  comment: Comment;
  delayHours: number;
  templateNames: string[];
  rank: number;
}
interface BrandConfig {
  brandName: string;
  createdBy: string;
  templates: TemplateSeed[];
  rules: RuleSeed[];
}

// ── MultiSkills Training ────────────────────────────────────────────────────
const MST: BrandConfig = {
  brandName: APP_BRAND.name,
  createdBy: "Larissa Tan",
  templates: [
    { name: "2, 1 Stars Without Comment - Reply A", body: `Hey \${Reviewer first name}, thanks for leaving a review. We’re sorry to know things didn’t go as well as we’d hoped. 🙏 Your feedback helps us learn and keep improving the experience for every student.\n\nOnly if you're up for it, please reach out to us at 1800 754 557. We’d like to chat and learn more.\n\nWe’d appreciate the chance to welcome you back in the future and turn things around. All the best with your training and career ahead 💪\n\nCheers,\nThe MultiSkills Training Team` },
    { name: "2, 1 Stars Without Comment - Reply B", body: `Hi \${Reviewer first name}, 👋\n\nThanks for sharing your feedback, we really appreciate you taking the time to let us know about your experience. 🙏 We’re sorry to hear things didn’t go as expected, and we’d like to understand what happened so we can make it right and improve for the future.\n\nIf you’re open to it, please reach out to us at 1800 754 557. We’d like the chance to chat and learn more.\n\nHoping that you'll come back again and allow us to turn things around. We wish you all the best as you continue building your career. 🚀\n\nTake care,\nThe MultiSkills Training Team` },
    { name: "3 Stars Without Comment - Reply A", body: `Hey \${Reviewer first name}, thanks for leaving a review! 🙂 We really appreciate the feedback, even a quick rating helps us see how we’re doing and where we can lift our game.\n\nIf you’re up for it, feel free to reach out at 1800 754 557, we’d love to hear from you.\n\nWe’d love to have you back again sometime. All the best with your career. 🚀\n\nCheers,\nThe MultiSkills Training Team` },
    { name: "3 Stars Without Comment - Reply B", body: `Hi \${Reviewer first name}, 👋\n\nThanks for leaving us a review, we really appreciate the feedback. We’re sorry to hear your experience was just okay, and we’d love the chance to learn what we could’ve done better. Your input helps us keep improving and deliver the best possible training for our students. 💪\n\nIf you’re happy to share more, feel free to reach out at 1800 754 557, we’d love to hear from you.\n\nWishing you all the best as you continue building your career! 🚀\n\nTake care,\nThe MultiSkills Training Team` },
    { name: "4 Stars Without Comment - Reply A", body: `Thanks so much for the review, \${Reviewer first name}! 😁 We’re happy that you had a great experience with us.\n\nWe really appreciate your support and hope to see you back again soon 🙌. Wishing you the best in your career. 🚀\n\nCheers,\nThe MultiSkills Training Team` },
    { name: "4 Stars Without Comment - Reply B", body: `\${Reviewer first name}, thanks for the 4 stars! ⭐⭐⭐⭐\n\nWe really appreciate you taking the time to leave a review — it’s great to know you had a good time training with us. 🙌\n\nWishing you all the best as you continue building your career! 🚀\n\nTake care,\nThe MultiSkills Training Team` },
    { name: "5 Stars Without Comment - Reply A", body: `Thanks so much, \${Reviewer first name}, for the awesome 5-star review! 🌟 We’re stoked that you had such a great experience with us — that’s exactly what we aim for every day.\n\nWe really appreciate your support and hope to see you back for more training soon. Wishing you all the best in your career. 🙌\n\nCheers,\nThe MultiSkills Training Team` },
    { name: "5 Stars Without Comment - Reply B", body: `\${Reviewer first name}, thanks so much for the 5 stars! ⭐⭐⭐⭐⭐ We really appreciate your support, and it means a lot to the team.\n\nAll the best as you continue building your career — we’re cheering you on! 🚀\n\nTake care,\nThe MultiSkills Training Team` },
    { name: "3 Stars With Comment - Reply A", body: `Thanks for sharing your experience, \${Reviewer first name}! 🙂 We really appreciate your feedback — it helps us keep improving and give our students the best possible training.\n\nIf you’re open to sharing more, please get in touch at 1800 754 557 — we’re always happy to listen and get better.\n\nWe’d love to have you back again in the future. Wishing you all the best as you continue building your career 🚀\n\nCheers,\nThe MultiSkills Training Team` },
    { name: "3 Stars With Comment - Reply B", body: `Hi \${Reviewer first name}, 👋\n\nThanks for sharing your thoughts — we really appreciate you taking the time to leave a review. We’re sorry to hear your experience wasn’t as smooth as it should’ve been, and we’d love to learn a bit more so we can keep improving. 🙏\n\nIf you’re happy to chat, feel free to get in touch at 1800 754 557 — we’re always keen to listen and make things better.\n\nThanks again for your feedback, and we hope to see you again in the future. 🙂\n\nTake care,\nThe MultiSkills Training Team` },
    { name: "4 Stars With Comment - Reply A", body: `Thanks so much, \${Reviewer first name}, for leaving us a great review 😃 We’re really happy to hear you had a good experience with us! Your feedback means a lot and helps us keep improving what we do.\n\nWe truly appreciate your support and hope to see you again soon. Wishing you all the best in your career journey 🚀\n\nCheers,\nThe MultiSkills Training Team` },
    { name: "4 Stars With Comment - Reply B", body: `Hey \${Reviewer first name}, thanks heaps for taking the time to share your feedback! 😊 We’re so glad you enjoyed your experience and really appreciate your kind words. Your review helps us keep lifting the bar and making training even better for our students.\n\nAll the best with your future goals — we’d love to have you back again sometime. 🙌\n\nTake care,\nThe MultiSkills Training Team` },
    { name: "5 Stars With Comment - Reply A", body: `Thank you so much, \${Reviewer first name}, for your awesome review. 🥳 We’re so happy to hear you had such a great experience with us! Our team always aims to make learning enjoyable and rewarding, so it’s fantastic to know we hit the mark.\n\nYour support means a lot, and we’d love to see you back again in the future. Thanks for choosing MultiSkills Training, we really appreciate it!\n\nAll the best with your career. 🙌\n\nCheers,\nThe MultiSkills Training Team` },
    { name: "5 Stars With Comment - Reply B", body: `Thanks a bunch, \${Reviewer first name}, for the lovely review! 🎉 We’re stoked to hear you had such a positive experience with us. Our team puts a lot of effort into creating a great learning environment, so it’s awesome to know it paid off.\n\nWe really appreciate your support and hope to see you again soon. All the best with your future goals! 💪\n\nCheers,\nThe MultiSkills Training Team` },
    { name: "5 Stars With Comment - Reply C", body: `Hey \${Reviewer first name}, thanks so much for the great feedback! 😊 We’re thrilled you enjoyed your time with us — that’s exactly what we aim for every day.\n\nYour kind words mean a lot, and we wish you all the best as you continue building your career. 😎\n\nTake care,\nThe MultiSkills Training Team` },
    { name: "5 Stars With Comment - Reply D", body: `Wow, thanks heaps, \${Reviewer first name}! 🙌 We love hearing stories like yours — it makes all the hard work worth it. We’re so glad you had an awesome experience training with us.\n\nGood luck with your career journey, and hopefully we’ll see you again down the track! 🚀\n\nTake care,\nThe MultiSkills Training Team` },
  ],
  rules: [
    { name: "Reply to 2 and 1 Stars Without Comment", ratings: [1, 2], comment: "ABSENT", delayHours: 4, rank: 60, templateNames: ["2, 1 Stars Without Comment - Reply A", "2, 1 Stars Without Comment - Reply B"] },
    { name: "Reply to 3 Stars Without Comment", ratings: [3], comment: "ABSENT", delayHours: 24, rank: 50, templateNames: ["3 Stars Without Comment - Reply A", "3 Stars Without Comment - Reply B"] },
    { name: "Reply to 4 Stars Without Comment", ratings: [4], comment: "ABSENT", delayHours: 24, rank: 40, templateNames: ["4 Stars Without Comment - Reply A", "4 Stars Without Comment - Reply B"] },
    { name: "Reply to 5 Stars Without Comment", ratings: [5], comment: "ABSENT", delayHours: 24, rank: 30, templateNames: ["5 Stars Without Comment - Reply A", "5 Stars Without Comment - Reply B"] },
    { name: "Reply to 3 Stars With Comment", ratings: [3], comment: "PRESENT", delayHours: 24, rank: 50, templateNames: ["3 Stars With Comment - Reply A", "3 Stars With Comment - Reply B"] },
    { name: "Reply to 4 Stars With Comment", ratings: [4], comment: "PRESENT", delayHours: 24, rank: 40, templateNames: ["4 Stars With Comment - Reply A", "4 Stars With Comment - Reply B"] },
    { name: "Reply to 5 Stars With Comment", ratings: [5], comment: "PRESENT", delayHours: 24, rank: 30, templateNames: ["5 Stars With Comment - Reply A", "5 Stars With Comment - Reply B", "5 Stars With Comment - Reply C", "5 Stars With Comment - Reply D"] },
  ],
};

async function seedBrand(config: BrandConfig) {
  const brand = await prisma.brand.findUnique({ where: { name: config.brandName } });
  if (!brand) {
    console.warn(`Brand "${config.brandName}" not found - skipping.`);
    return;
  }

  // Idempotent reseed: clear this brand's config first.
  await prisma.autoReplyRule.deleteMany({ where: { brandId: brand.id } });
  await prisma.responseTemplate.deleteMany({ where: { brandId: brand.id } });

  const nameToId = new Map<string, string>();
  for (const t of config.templates) {
    const created = await prisma.responseTemplate.create({
      data: { brandId: brand.id, name: t.name, body: t.body, createdBy: config.createdBy },
    });
    nameToId.set(t.name, created.id);
  }

  for (const r of config.rules) {
    const templateIds = r.templateNames.map((n) => {
      const id = nameToId.get(n);
      if (!id) throw new Error(`Rule "${r.name}" references missing template "${n}"`);
      return id;
    });
    await prisma.autoReplyRule.create({
      data: {
        brandId: brand.id,
        name: r.name,
        ratings: r.ratings,
        comment: r.comment,
        delayHours: r.delayHours,
        rank: r.rank,
        templateIds,
      },
    });
  }

  console.log(`Seeded ${config.brandName}: ${config.templates.length} templates, ${config.rules.length} rules.`);
}

async function main() {
  await seedBrand(MST);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
