-- Marks reviews no longer returned by the platform (filtered/deleted), so the
-- dashboard can hide stale records.
ALTER TABLE "reviews" ADD COLUMN "removedAt" TIMESTAMP(3);
