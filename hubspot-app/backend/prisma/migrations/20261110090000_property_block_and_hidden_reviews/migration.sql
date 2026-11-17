ALTER TABLE "brands" ADD COLUMN "hubspotPropertiesBlockedReason" TEXT;
ALTER TABLE "reviews" ADD COLUMN "hiddenFromWidgets" BOOLEAN NOT NULL DEFAULT false;
