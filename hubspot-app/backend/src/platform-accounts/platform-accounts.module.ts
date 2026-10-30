import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { HubSpotModule } from "../hubspot/hubspot.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { GoogleOAuthService } from "./google-oauth.service";
import { GoogleReplyWriter } from "./google-reply-writer";
import { GoogleReviewsClient } from "./google-reviews.client";
import { PlatformAccountsController } from "./platform-accounts.controller";
import { PlatformAccountsService } from "./platform-accounts.service";
import { ReviewPosterService } from "./review-poster.service";
import { ReviewsSyncService } from "./reviews-sync.service";

/**
 * Each business's connected Google logins, the review sync built on them, and
 * posting replies back. Imports HubSpot to save synced reviews under contacts.
 */
@Module({
  imports: [ReviewsModule, HubSpotModule, BillingModule],
  controllers: [PlatformAccountsController],
  providers: [
    GoogleOAuthService,
    GoogleReviewsClient,
    GoogleReplyWriter,
    PlatformAccountsService,
    ReviewPosterService,
    ReviewsSyncService,
  ],
  exports: [PlatformAccountsService, ReviewsSyncService, ReviewPosterService],
})
export class PlatformAccountsModule {}
