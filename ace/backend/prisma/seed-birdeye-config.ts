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
 * This deployment is single-brand, so only ACE's config lives here.
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

// ── ACE Training ────────────────────────────────────────────────────────────
const ACE: BrandConfig = {
  brandName: APP_BRAND.name,
  createdBy: "Larissa Tan",
  templates: [
    { name: "2, 1 Stars Without Comment - Reply A", body: `\${Reviewer first name}, thank you for taking the time to leave us a review. We’re sorry to hear we didn’t meet your expectations this time, but we truly appreciate you letting us know.\n\nYour feedback helps us improve, and we hope to have the opportunity to welcome you back and provide a better experience in the future. Wishing you all the best in your career ahead.\n\nFrom,\nThe ACE Training Team` },
    { name: "2, 1 Stars Without Comment - Reply B", body: `Thank you for taking the time to leave us a review, \${Reviewer first name}. We truly appreciate you taking the time to let us know how you feel, and we’re sorry to see that we didn’t quite meet your expectations this time.\n\nYour feedback will help us improve, and we hope to have the opportunity to provide a better experience in the future. Wishing you all the best in your career ahead.\n\nFrom,\nThe ACE Training Team` },
    { name: "3 Stars Without Comment - Reply A", body: `\${Reviewer first name}, thank you for taking the time to leave us a review. 🙂 We’re sorry to hear we didn’t quite meet your expectations this time, but we truly appreciate your feedback and will use it to keep improving.\n\nYour support means a lot to us, and we hope to have the opportunity to have you back. Wishing you all the best in your career. 💪\n\nFrom,\nThe ACE Training Team` },
    { name: "3 Stars Without Comment - Reply B", body: `Thank you, \${Reviewer first name}, for taking the time to leave us a review. 🙂 We didn’t quite meet your expectations this time, but your feedback will help us keep improving.\n\nYour support means a lot to us, and we hope to have the opportunity to have you back. Wishing you all the best in your career 💪.\n\nFrom,\nThe ACE Training Team` },
    { name: "4 Stars Without Comment - Reply A", body: `\${Reviewer first name}, thank you so much for leaving us a review. 😁 We’re glad to hear you had a positive experience at ACE Training, and your feedback motivates us to keep improving and delivering the best possible training for our students.\n\nWe truly appreciate your support and hope to welcome you back again in the future. 🙌 Wishing you every success in your career. 🚀\n\nFrom,\nThe ACE Training Team` },
    { name: "4 Stars Without Comment - Reply B", body: `Thank you so much, \${Reviewer first name}, for leaving us a review. 😌 Your feedback motivates us to keep improving and delivering the best possible training for our students. We’re also glad to hear you had a positive experience with our team.\n\nLooking forward to welcoming you back again in the future 🙌. Wishing you every success in your career 🚀.\n\nFrom,\nThe ACE Training Team` },
    { name: "5 Stars Without Comment - Reply A", body: `\${Reviewer first name}, thank you for taking the time to give us a 5-star review. 🌟 We continuously strive to give our students the best possible learning experience, and we’re thrilled to know we met your expectations.\n\nWe look forward to having you back to train with us. Thank you for choosing ACE Training.\n\nWishing you the very best in your career. 🙏\n\nFrom,\nThe ACE Training Team` },
    { name: "5 Stars Without Comment - Reply B", body: `Thank you for giving us a 5-star review, \${Reviewer first name}. 😊 We are happy to know that our continuous effort to provide quality training for our students is working.\n\nWe would love to have you train with us again. Thank you for choosing ACE Training.\n\nAll the best in your career. 🙌\n\nFrom,\nThe ACE Training Team` },
    { name: "3 Stars With Comment - Reply A", body: `Thank you for sharing your experience, \${Reviewer first name}. 🙂 Your feedback helps us improve and deliver the best possible training for our students. 💪\n\nIf you are willing to share more, feel free to contact us at 1800 456 094.\n\nWe hope to welcome you back and train with us again. 🙌 Wishing you every success in your career. 🚀\n\nFrom,\nThe ACE Training Team` },
    { name: "3 Stars With Comment - Reply B", body: `Thank you, \${Reviewer first name}, for sharing your thoughts 🙂. We deliver the best possible training for our students because of valuable feedback like yours, and they will be taken into consideration for future improvements.\n\nIf you are open to sharing more, feel free to contact us at 1800 456 094.\n\nWe hope to have you train with us again 🙌. Wishing you all the best in your career 🚀.\n\nFrom,\nThe ACE Training Team` },
    { name: "4 Stars With Comment - Reply A", body: `Thank you so much, \${Reviewer name}, for taking the time to share your positive review. 😃 We’re glad to hear you had a good experience with us. Feedback like yours helps us continue to improve and deliver the best possible training for our students.\n\nWe truly value your support and look forward to welcoming you back again in the future. 🙌 Wishing you every success in your career. 🚀\n\nFrom,\nThe ACE Training Team` },
    { name: "4 Stars With Comment - Reply B", body: `Thank you for taking the time to give us a positive review, \${Reviewer first name}. 😀 It’s great to know you had a good time with us. Your support and feedback encourages us to keep improving to give our students the best possible experience. We’d love to welcome you back again in the future. 🙌\n\nWe wish you all the best as you move forward in your career. 🙏\n\nFrom,\nThe ACE Training Team` },
    { name: "5 Stars With Comment - Reply A", body: `Thank you so much, \${Reviewer first name}, for taking the time to share such a kind and positive review. 😊 We’re thrilled to hear about your fantastic experience with us. Our goal is always to provide a top-notch learning environment that helps our students succeed, and we’re delighted to know we met your expectations.\n\nYour support means a great deal to us, and we look forward to welcoming you back in the future. Thank you for choosing ACE Training.\n\nWishing you the very best in your career. 🙏\n\nFrom,\nThe ACE Training Team` },
    { name: "5 Stars With Comment - Reply B", body: `Thank you so much for leaving such a thoughtful review, \${Reviewer first name}. 😁 Hearing about your experience with us truly makes our day and reminds us why we do what we do. Our goal is always to provide top-quality training so our students succeed, and we’re thrilled to know we met your expectations.\n\nWe appreciate your support and look forward to welcoming you back in the future. Wishing you every success in your career. 🙏\n\nFrom,\nThe ACE Training Team` },
    { name: "5 Stars With Comment - Reply C", body: `\${Reviewer first name}, we’re so grateful you took the time to share your experience with us. 🙏 Knowing that your training with us was so positive means a great deal to our team. ❤️ Every review like yours reminds us why we’re passionate about supporting students in reaching their goals.\n\nThank you for trusting ACE Training with your learning journey. We wish you continued success in your career 🚀 and look forward to seeing you again in the future.\n\nFrom,\nThe ACE Training Team` },
    { name: "5 Stars With Comment - Reply D", body: `\${Reviewer first name}, your feedback truly brightened our day! 🌟 It’s wonderful to hear that you had such a rewarding experience with us. At ACE Training, we believe that learning should be supportive, challenging, and rewarding, and it’s fantastic to know that came through in your training.\n\nWe appreciate your kind words and your support. 🤝 All the very best as you continue to grow in your career 💪, and we hope to welcome you back.\n\nFrom,\nThe ACE Training Team` },
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
  await seedBrand(ACE);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
