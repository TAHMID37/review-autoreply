-- Google's own rating summary per location (for the rating goal calculator).
ALTER TABLE "locations" ADD COLUMN "googleAverageRating" DOUBLE PRECISION;
ALTER TABLE "locations" ADD COLUMN "googleTotalReviews" INTEGER;
ALTER TABLE "locations" ADD COLUMN "googleSummaryAt" TIMESTAMP(3);

-- Scheduled review report emails.
CREATE TYPE "ReportFrequency" AS ENUM ('NONE', 'WEEKLY', 'MONTHLY');
ALTER TABLE "brands" ADD COLUMN "reportFrequency" "ReportFrequency" NOT NULL DEFAULT 'NONE';
ALTER TABLE "brands" ADD COLUMN "reportLastSentAt" TIMESTAMP(3);
