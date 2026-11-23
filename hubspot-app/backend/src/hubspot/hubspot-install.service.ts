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
import { HubSpotAccessRevokedError, HubSpotOAuthService } from "./hubspot-oauth.service";

export interface InstallResult {
  /** Only set when the caller may sign the person in (the flow carried our state). */
  loginCode?: string;
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

  async completeOAuth(code: string, issueLogin = true): Promise<InstallResult> {
    const tokens = await this.oauth.exchangeCode(code);
    const info = await this.oauth.getTokenInfo(tokens.accessToken);

    const existing = await this.prisma.brand.findUnique({ where: { hubspotPortalId: info.portalId } });
    if (existing) await this.finishMissedUninstall(existing.id);
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
    return { loginCode: issueLogin ? await this.auth.createLoginCode(user.id) : undefined, isNewBusiness: !existing };
  }

  /**
   * HubSpot does not always tell us when the app is removed. If this business
   * still looks installed but HubSpot refuses its old refresh token, the app was
   * uninstalled and is now being installed again: do the uninstall cleanup first
   * (Google disconnected and revoked, billing cancelled) so the business starts
   * setup again instead of silently keeping the old connections. A network or
   * server error proves nothing, so only an explicit refusal counts.
   */
  private async finishMissedUninstall(brandId: string): Promise<void> {
    const installation = await this.prisma.hubSpotInstallation.findUnique({ where: { brandId } });
    if (!installation || installation.status !== HubSpotInstallStatus.INSTALLED || !installation.refreshToken) return;
    try {
      await this.oauth.refresh(this.vault.decrypt(installation.refreshToken));
    } catch (error) {
      if (error instanceof HubSpotAccessRevokedError) {
        await this.api.markUninstalled(brandId, "the app was uninstalled in HubSpot and has now been installed again");
      }
    }
  }

  /**
   * HubSpot told us the app was removed from an account. Stops syncing, erases
   * credentials and cancels billing; the retention job deletes the business's
   * data from our database after RETENTION_DAYS. Nothing is touched in HubSpot.
   */
  async handleUninstalledByHubSpot(portalId: string): Promise<boolean> {
    const brand = await this.prisma.brand.findUnique({ where: { hubspotPortalId: portalId }, select: { id: true, status: true } });
    if (!brand || brand.status !== BrandStatus.ACTIVE) return false;
    await this.api.markUninstalled(brand.id, "HubSpot reported the app was uninstalled");
    return true;
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
