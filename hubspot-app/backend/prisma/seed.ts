import { Platform, PrismaClient, UserRole } from "@prisma/client";
import { seedDefaultReplyConfig } from "../src/brands/default-reply-config";

const prisma = new PrismaClient();

/** Must match DEV_PORTAL_ID in src/auth/auth.service.ts. */
const DEV_PORTAL_ID = "dev-portal";

/**
 * Local development seed: one demo business (standing in for a HubSpot
 * account that installed the app), its admin, two ticked locations, the
 * starter templates/rules, and a handful of sample reviews - including a
 * 5-star review that hides a complaint, to prove routing is not rating-only.
 *
 * Sign in to it with DEV_LOGIN_ENABLED=true and the "Dev sign-in" button.
 * Real businesses are created by installing the app from HubSpot, never here.
 * Idempotent: safe to re-run.
 */
const SAMPLE_REVIEWS = [
  { reviewerName: "Sarah M.", rating: 5, reviewText: "Booked online and was seen on time. The team was friendly and explained everything clearly." },
  { reviewerName: "James Taylor", rating: 5, reviewText: "" },
  { reviewerName: "Priya K.", rating: 4, reviewText: "Good service overall. Parking was a bit tight in the morning but that's minor." },
  { reviewerName: "Dan R.", rating: 2, reviewText: "Service was fine but the wait at reception was much longer than I expected." },
  { reviewerName: "Michael O.", rating: 1, reviewText: "Still waiting for someone to call me back weeks later. I want a refund." },
  { reviewerName: "Chloe W.", rating: 5, reviewText: "Great experience overall, but one of the staff at the front desk was extremely rude to me." },
  { reviewerName: "Ahmed H.", rating: 1, reviewText: "" },
  { reviewerName: "Rebecca L.", rating: 3, reviewText: "It was okay. The room was crowded and hard to hear at the back." },
];

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed demo data in production.");
  }

  const brand = await prisma.brand.upsert({
    where: { hubspotPortalId: DEV_PORTAL_ID },
    update: {},
    create: {
      name: "Demo Business",
      hubspotPortalId: DEV_PORTAL_ID,
      hubspotDomain: "demo-business.com",
      alertEmails: ["admin@example.com"],
    },
  });

  await prisma.user.upsert({
    where: { brandId_email: { brandId: brand.id, email: "admin@example.com" } },
    update: {},
    create: { brandId: brand.id, email: "admin@example.com", name: "Demo Admin", role: UserRole.ADMIN },
  });

  await prisma.$transaction((tx) => seedDefaultReplyConfig(tx, brand.id));

  const locations = [];
  for (const [i, name] of ["Demo Business - City", "Demo Business - Northside"].entries()) {
    locations.push(
      await prisma.location.upsert({
        where: { brandId_googleLocationId: { brandId: brand.id, googleLocationId: `demo-${i + 1}` } },
        update: {},
        create: {
          brandId: brand.id,
          googleLocationId: `demo-${i + 1}`,
          name,
          syncEnabled: true,
          mapsUri: "https://maps.google.com/",
        },
      }),
    );
  }

  for (const [index, sample] of SAMPLE_REVIEWS.entries()) {
    const location = locations[index % locations.length];
    const externalReviewId = `sample-${index + 1}`;
    await prisma.review.upsert({
      where: { platform_locationId_externalReviewId: { platform: Platform.GOOGLE, locationId: location.id, externalReviewId } },
      update: {},
      create: {
        platform: Platform.GOOGLE,
        locationId: location.id,
        externalReviewId,
        reviewerName: sample.reviewerName,
        rating: sample.rating,
        reviewText: sample.reviewText,
        reviewedAt: new Date(Date.now() - index * 36 * 60 * 60 * 1000),
        // Not a real HubSpot account - keep the demo reviews out of CRM sync.
        hubspotDirty: false,
      },
    });
  }

  console.log(`Seed complete: "${brand.name}" with ${locations.length} locations and ${SAMPLE_REVIEWS.length} sample reviews.`);
  console.log("Draft replies with: POST /reviews/process (or the Reviews screen).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
