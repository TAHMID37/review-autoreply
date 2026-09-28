import { PrismaClient, Platform } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Sample reviews for local development, so the dashboard and the risk router
 * can be exercised before the Google connection exists.
 *
 * Includes the case the proposal specifically calls out — a 5-star review
 * that still contains a complaint — to prove routing is not rating-only.
 */
const SAMPLE_REVIEWS = [
  { reviewerName: "Sarah M.", rating: 5, reviewText: "Did my forklift licence (LF) here and passed first go. The instructor was clear and patient. Highly recommend." },
  { reviewerName: "James T.", rating: 5, reviewText: "Booked the White Card course online and finished in a day. Simple process, friendly staff." },
  { reviewerName: "Priya K.", rating: 4, reviewText: "Good training and useful content. Parking was a bit tight in the morning but that's minor." },
  { reviewerName: "Dan R.", rating: 2, reviewText: "Course content was good but the wait at reception on the day was longer than I expected." },
  { reviewerName: "Michael O.", rating: 1, reviewText: "Still waiting on my certificate weeks later and nobody answers. I want a refund." },
  { reviewerName: "Chloe W.", rating: 5, reviewText: "Great course overall, but one of the staff at the front desk was extremely rude to me." },
  { reviewerName: "Ahmed H.", rating: 5, reviewText: "Excellent trainer, explained everything clearly. Felt confident on the equipment by the end." },
  { reviewerName: "Rebecca L.", rating: 3, reviewText: "The training was okay but the room was crowded and hard to hear at the back." },
];

async function main() {
  const locations = await prisma.location.findMany({ include: { brand: true }, orderBy: { name: "asc" } });
  if (locations.length === 0) {
    throw new Error("No locations found — run `npm run db:seed` first.");
  }

  let created = 0;
  for (const [index, sample] of SAMPLE_REVIEWS.entries()) {
    const location = locations[index % locations.length];
    const externalReviewId = `sample-${index + 1}`;
    const reviewedAt = new Date(Date.now() - index * 36 * 60 * 60 * 1000);

    await prisma.review.upsert({
      where: {
        platform_locationId_externalReviewId: {
          platform: Platform.GOOGLE,
          locationId: location.id,
          externalReviewId,
        },
      },
      update: {},
      create: {
        platform: Platform.GOOGLE,
        locationId: location.id,
        externalReviewId,
        reviewerName: sample.reviewerName,
        rating: sample.rating,
        reviewText: sample.reviewText,
        reviewedAt,
      },
    });
    created++;
  }

  console.log(`Seeded ${created} sample reviews across ${locations.length} campuses.`);
  console.log("Run the AI pipeline with: POST /reviews/process");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
