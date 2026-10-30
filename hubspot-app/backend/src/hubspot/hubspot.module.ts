import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BillingModule } from "../billing/billing.module";
import { RepliesModule } from "../replies/replies.module";
import { UsersModule } from "../users/users.module";
import { HubSpotApiClient } from "./hubspot-api.client";
import { HubSpotCrmService } from "./hubspot-crm.service";
import { HubSpotExtensionController } from "./hubspot-extension.controller";
import { HubSpotInstallService } from "./hubspot-install.service";
import { HubSpotOAuthService } from "./hubspot-oauth.service";
import { HubSpotSignatureGuard } from "./hubspot-signature.guard";
import { HubSpotController } from "./hubspot.controller";

/**
 * Everything HubSpot: install / sign-in (OAuth), the authorised API client,
 * saving reviews under contacts, and the signed endpoints our app cards call.
 */
@Module({
  imports: [AuthModule, UsersModule, RepliesModule, BillingModule],
  controllers: [HubSpotController, HubSpotExtensionController],
  providers: [HubSpotOAuthService, HubSpotApiClient, HubSpotCrmService, HubSpotInstallService, HubSpotSignatureGuard],
  exports: [HubSpotCrmService, HubSpotApiClient],
})
export class HubSpotModule {}
