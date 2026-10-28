import { Injectable, Logger } from "@nestjs/common";
import { BrandStatus, HubSpotInstallStatus } from "@prisma/client";
import { AuthService } from "../auth/auth.service";
import { seedDefaultReplyConfig } from "../brands/default-reply-config";
import { BillingService } from "../billing/billing.service";
import { TokenVaultService } from "../common/crypto/token-vault.service";
import { PrismaService } from "../common/prisma/prisma.service";
import { UsersService } from "../users/users.service";
import { HubSpotApiClient } from "./hubspot-api.client";
import { HubSpotCrmService } from "./hubspot-crm.service";
import { HubSpotOAuthService } from "./hubspot-oauth.service";

export interface InstallResult {
  loginCode: string;
  isNewBusiness: boolean;
}

/**
 * Install and sign-in are the same HubSpot OAuth flow. The first time a
 * HubSpot account completes it, a business is created for it with starter
 * reply templates; every later time it simply refreshes the stored tokens and
 * signs that HubSpot user in.
 */
@Injectable()
export class HubSpotInstallService {
  private readonly logger = new Logger(HubSpotInstallService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauth: HubSpotOAuthService,
    private readonly api: HubSpotApiClient,
    private readonly crm: HubSpotCrmService,
    private readonly vault: TokenVaultService,
    private readonly users: UsersService,
    private readonly auth: AuthService,
    private readonly billing: BillingService,
  ) {}

  async completeOAuth(code: string): Promise<InstallResult> {
    const tokens = await this.oauth.exchangeCode(code);
    const info = await this.oauth.getTokenInfo(tokens.accessToken);

    const existing = await this.prisma.brand.findUnique({ where: { hubspotPortalId: info.portalId } });
    const tokenData = {
      accessToken: this.vault.encrypt(tokens.accessToken),
      refreshToken: this.vault.encrypt(tokens.refreshToken),
      tokenExpiresAt: tokens.expiresAt,
      scopes: info.scopes,
      status: HubSpotInstallStatus.INSTALLED,
      uninstalledAt: null,
    };

    const brand = await this.prisma.$transaction(async (tx) => {
      const b = existing
        ? await tx.brand.update({
            where: { id: existing.id },
            data: { status: BrandStatus.ACTIVE, uninstalledAt: null, hubspotDomain: info.hubDomain ?? existing.hubspotDomain },
          })
        : await tx.brand.create({
            data: {
              name: businessNameFromDomain(info.hubDomain) ?? `HubSpot account ${info.portalId}`,
              hubspotPortalId: info.portalId,
              hubspotDomain: info.hubDomain,
              alertEmails: [info.userEmail.toLowerCase()],
            },
          });
      await tx.hubSpotInstallation.upsert({
        where: { brandId: b.id },
        update: tokenData,
        create: {
          brandId: b.id,
          portalId: info.portalId,
          installedByHubspotUserId: info.hubspotUserId,
          installedByEmail: info.userEmail,
          ...tokenData,
        },
      });
      await seedDefaultReplyConfig(tx, b.id);
      return b;
    });

    const user = await this.users.upsertFromHubSpot(brand.id, {
      hubspotUserId: info.hubspotUserId,
      email: info.userEmail,
    });

    // Our contact properties. A failure here must not block sign-in; the CRM
    // sync retries it before it writes anything.
    this.crm.ensureProperties(brand.id).catch((e) =>
      this.logger.warn(`Could not create HubSpot properties for ${brand.id} yet: ${e instanceof Error ? e.message : e}`),
    );

    if (!existing) {
      this.logger.log(`New business installed the app: ${brand.name} (portal ${info.portalId}).`);
    }
    return { loginCode: await this.auth.createLoginCode(user.id), isNewBusiness: !existing };
  }

  /**
   * Uninstall requested from our dashboard: tell HubSpot to remove the app,
   * cancel billing and stop all syncing. With `deleteData`, the business and
   * everything under it (reviews, reviewer names, tokens) is deleted.
   */
  async uninstall(brandId: string, deleteData: boolean): Promise<void> {
    try {
      await this.api.request(brandId, "DELETE", "/appinstalls/2026-03/external-install");
    } catch (error) {
      this.logger.warn(`HubSpot uninstall call failed for ${brandId} (continuing): ${error instanceof Error ? error.message : error}`);
    }
    await this.billing.cancelImmediately(brandId).catch((e) =>
      this.logger.error(`Could not cancel billing for ${brandId}: ${e instanceof Error ? e.message : e}`),
    );
    await this.api.markUninstalled(brandId, "uninstalled from the dashboard");
    if (deleteData) {
      await this.prisma.brand.delete({ where: { id: brandId } });
      this.logger.warn(`Deleted all data for business ${brandId} on request.`);
    }
  }
}

/** "acme-dental.com" -> "Acme Dental". A starting name the business can edit. */
export function businessNameFromDomain(domain?: string): string | null {
  if (!domain) return null;
  const label = domain.replace(/^www\./, "").split(".")[0];
  if (!label || /^\d+$/.test(label)) return null;
  return label
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
