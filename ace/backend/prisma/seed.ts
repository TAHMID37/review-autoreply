import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";
import { APP_BRAND } from "../src/config/app-brand";

const prisma = new PrismaClient();

/** Only ever used for local development, and only when ADMIN_SEED_PASSWORD is
 *  unset. Must satisfy the 8-character minimum enforced by the login DTO. */
const DEV_FALLBACK_PASSWORD = "change-me-now";

/** Filler campuses so the dashboard isn't empty before Google is connected -
 *  the real ones arrive (and replace these) on the first review sync. */
const PLACEHOLDER_CAMPUSES = 4;

/**
 * Idempotent dev/staging seed for this single-brand deployment: the one brand,
 * its placeholder campuses, and one admin user to log into the dashboard.
 *
 * Safe to re-run - everything is upserted by a stable natural key.
 */
async function main() {
  const brand = await prisma.brand.upsert({
    where: { name: APP_BRAND.name },
    update: {},
    create: {
      name: APP_BRAND.name,
      tone: APP_BRAND.tone,
      language: "en",
    },
  });

  for (let i = 1; i <= PLACEHOLDER_CAMPUSES; i++) {
    await prisma.location.upsert({
      where: { id: `${brand.id}-placeholder-campus-${i}` },
      update: {},
      create: {
        id: `${brand.id}-placeholder-campus-${i}`,
        brandId: brand.id,
        name: `${brand.name} - Campus ${i} (rename me)`,
      },
    });
  }

  // `||` not `??`: dotenv turns a blank `KEY=` line into an empty string, and
  // `??` would happily accept "" - seeding an admin account with no password.
  const adminEmail = process.env.ADMIN_SEED_EMAIL?.trim() || "admin@example.com";
  const configuredPassword = process.env.ADMIN_SEED_PASSWORD?.trim();
  const adminPassword = configuredPassword || DEV_FALLBACK_PASSWORD;

  if (!configuredPassword) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "ADMIN_SEED_PASSWORD must be set when seeding in production - refusing to create an admin account with a publicly known password.",
      );
    }
    console.warn(
      `⚠ ADMIN_SEED_PASSWORD not set - using the insecure development password "${DEV_FALLBACK_PASSWORD}" for ${adminEmail}. ` +
        "Set ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD in this app's .env before seeding a real environment.",
    );
  }

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Admin",
      role: "ADMIN",
      passwordHash: await argon2.hash(adminPassword),
    },
  });

  console.log("Seed complete:", { brand: brand.name, adminEmail });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
