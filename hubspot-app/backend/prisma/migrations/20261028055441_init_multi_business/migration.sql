-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "BrandStatus" AS ENUM ('ACTIVE', 'UNINSTALLED');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('GOOGLE');

-- CreateEnum
CREATE TYPE "PlatformAccountStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "HubSpotInstallStatus" AS ENUM ('INSTALLED', 'UNINSTALLED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('NEW', 'PROCESSING', 'PROCESSED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'HIGH');

-- CreateEnum
CREATE TYPE "ReplyStatus" AS ENUM ('GENERATED', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'FAILED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('SLACK', 'EMAIL');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "CommentCondition" AS ENUM ('PRESENT', 'ABSENT', 'ANY');

-- CreateEnum
CREATE TYPE "NewContactPolicy" AS ENUM ('ALL_REVIEWERS', 'COMMENTERS_ONLY');

-- CreateEnum
CREATE TYPE "HubSpotMatch" AS ENUM ('EXISTING', 'CREATED', 'CREATED_AMBIGUOUS', 'SKIPPED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('NONE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'UNPAID', 'CANCELED', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "WidgetLayout" AS ENUM ('CAROUSEL', 'GRID', 'LIST', 'BADGE');

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "BrandStatus" NOT NULL DEFAULT 'ACTIVE',
    "hubspotPortalId" TEXT,
    "hubspotDomain" TEXT,
    "tone" TEXT NOT NULL DEFAULT 'Professional, friendly, and concise.',
    "language" TEXT NOT NULL DEFAULT 'en',
    "replyRules" JSONB,
    "forbiddenWords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "autoReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoReplyConsentAt" TIMESTAMP(3),
    "autoReplyConsentByUserId" TEXT,
    "autoReplyStartAt" TIMESTAMP(3),
    "alertEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "slackWebhookUrl" TEXT,
    "crmSyncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "newContactPolicy" "NewContactPolicy" NOT NULL DEFAULT 'ALL_REVIEWERS',
    "hubspotPropertiesReadyAt" TIMESTAMP(3),
    "uninstalledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "hubspotUserId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hubspot_installations" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "installedByHubspotUserId" TEXT,
    "installedByEmail" TEXT,
    "status" "HubSpotInstallStatus" NOT NULL DEFAULT 'INSTALLED',
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uninstalledAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hubspot_installations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_codes" (
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_codes_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "response_templates" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL DEFAULT 'System',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "response_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auto_reply_rules" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" "Platform" NOT NULL DEFAULT 'GOOGLE',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "ratings" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "comment" "CommentCondition" NOT NULL DEFAULT 'ANY',
    "delayHours" INTEGER NOT NULL DEFAULT 24,
    "templateIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auto_reply_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Australia/Melbourne',
    "googleLocationId" TEXT,
    "mapsUri" TEXT,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_accounts" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL DEFAULT 'GOOGLE',
    "accountEmail" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "status" "PlatformAccountStatus" NOT NULL DEFAULT 'CONNECTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_locations" (
    "id" TEXT NOT NULL,
    "platformAccountId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "externalLocationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL DEFAULT 'GOOGLE',
    "externalReviewId" TEXT NOT NULL,
    "reviewerName" TEXT NOT NULL,
    "reviewerPhotoUrl" TEXT,
    "rating" INTEGER NOT NULL,
    "reviewText" TEXT NOT NULL DEFAULT '',
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ReviewStatus" NOT NULL DEFAULT 'NEW',
    "removedAt" TIMESTAMP(3),
    "hubspotContactId" TEXT,
    "hubspotNoteId" TEXT,
    "hubspotMatch" "HubSpotMatch",
    "hubspotDirty" BOOLEAN NOT NULL DEFAULT true,
    "hubspotSyncedAt" TIMESTAMP(3),
    "hubspotSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_analyses" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "sentiment" TEXT NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "riskFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "replies" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "aiDraft" TEXT NOT NULL,
    "finalReply" TEXT,
    "status" "ReplyStatus" NOT NULL DEFAULT 'GENERATED',
    "aiProvider" TEXT NOT NULL,
    "aiModel" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "postedAt" TIMESTAMP(3),
    "platformReplyId" TEXT,
    "failureReason" TEXT,
    "autoPostAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'NONE',
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "pastDueSince" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "widgets" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "layout" "WidgetLayout" NOT NULL DEFAULT 'CAROUSEL',
    "locationIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minRating" INTEGER NOT NULL DEFAULT 4,
    "maxReviews" INTEGER NOT NULL DEFAULT 12,
    "requireComment" BOOLEAN NOT NULL DEFAULT true,
    "theme" JSONB,
    "allowedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "widgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "error" TEXT,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_run_logs" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "brandId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "JobStatus" NOT NULL DEFAULT 'RUNNING',
    "error" TEXT,

    CONSTRAINT "job_run_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_webhook_events" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brands_hubspotPortalId_key" ON "brands"("hubspotPortalId");

-- CreateIndex
CREATE UNIQUE INDEX "users_brandId_hubspotUserId_key" ON "users"("brandId", "hubspotUserId");

-- CreateIndex
CREATE UNIQUE INDEX "users_brandId_email_key" ON "users"("brandId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "hubspot_installations_brandId_key" ON "hubspot_installations"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "hubspot_installations_portalId_key" ON "hubspot_installations"("portalId");

-- CreateIndex
CREATE INDEX "response_templates_brandId_idx" ON "response_templates"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "response_templates_brandId_name_key" ON "response_templates"("brandId", "name");

-- CreateIndex
CREATE INDEX "auto_reply_rules_brandId_idx" ON "auto_reply_rules"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "auto_reply_rules_brandId_name_key" ON "auto_reply_rules"("brandId", "name");

-- CreateIndex
CREATE INDEX "locations_brandId_idx" ON "locations"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "locations_brandId_googleLocationId_key" ON "locations"("brandId", "googleLocationId");

-- CreateIndex
CREATE INDEX "platform_accounts_brandId_idx" ON "platform_accounts"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "platform_accounts_brandId_platform_accountEmail_key" ON "platform_accounts"("brandId", "platform", "accountEmail");

-- CreateIndex
CREATE INDEX "platform_locations_locationId_idx" ON "platform_locations"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "platform_locations_platformAccountId_externalLocationId_key" ON "platform_locations"("platformAccountId", "externalLocationId");

-- CreateIndex
CREATE INDEX "reviews_locationId_idx" ON "reviews"("locationId");

-- CreateIndex
CREATE INDEX "reviews_hubspotDirty_idx" ON "reviews"("hubspotDirty");

-- CreateIndex
CREATE INDEX "reviews_hubspotContactId_idx" ON "reviews"("hubspotContactId");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_platform_locationId_externalReviewId_key" ON "reviews"("platform", "locationId", "externalReviewId");

-- CreateIndex
CREATE UNIQUE INDEX "review_analyses_reviewId_key" ON "review_analyses"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "replies_reviewId_key" ON "replies"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_brandId_key" ON "subscriptions"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripeCustomerId_key" ON "subscriptions"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripeSubscriptionId_key" ON "subscriptions"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "widgets_publicId_key" ON "widgets"("publicId");

-- CreateIndex
CREATE INDEX "widgets_brandId_idx" ON "widgets"("brandId");

-- CreateIndex
CREATE INDEX "notification_logs_reviewId_idx" ON "notification_logs"("reviewId");

-- CreateIndex
CREATE INDEX "job_run_logs_jobName_startedAt_idx" ON "job_run_logs"("jobName", "startedAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hubspot_installations" ADD CONSTRAINT "hubspot_installations_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_templates" ADD CONSTRAINT "response_templates_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_reply_rules" ADD CONSTRAINT "auto_reply_rules_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_accounts" ADD CONSTRAINT "platform_accounts_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_locations" ADD CONSTRAINT "platform_locations_platformAccountId_fkey" FOREIGN KEY ("platformAccountId") REFERENCES "platform_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_locations" ADD CONSTRAINT "platform_locations_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_analyses" ADD CONSTRAINT "review_analyses_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replies" ADD CONSTRAINT "replies_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replies" ADD CONSTRAINT "replies_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "widgets" ADD CONSTRAINT "widgets_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
