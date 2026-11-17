-- Which set of HubSpot contact properties exists for each business.
ALTER TABLE "brands" ADD COLUMN "hubspotPropertiesVersion" INTEGER NOT NULL DEFAULT 0;

-- Businesses that already had the first set (created-from + possible-duplicate) are version 1.
UPDATE "brands" SET "hubspotPropertiesVersion" = 1 WHERE "hubspotPropertiesReadyAt" IS NOT NULL;
