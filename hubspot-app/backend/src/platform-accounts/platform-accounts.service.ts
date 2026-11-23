import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Platform, PlatformAccount, PlatformAccountStatus } from "@prisma/client";
import { BillingService } from "../billing/billing.service";
import { TokenVaultService } from "../common/crypto/token-vault.service";
import { PrismaService } from "../common/prisma/prisma.service";
import { GoogleOAuthService } from "./google-oauth.service";
import { GoogleLocation, GoogleReviewsClient } from "./google-reviews.client";

/**
 * Owns each business's connected Google logins and their location links.
 * Tokens are only ever stored encrypted and only ever decrypted here.
 */
@Injectable()
export class PlatformAccountsService {
  private readonly logger = new Logger(PlatformAccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauth: GoogleOAuthService,
    private readonly google: GoogleReviewsClient,
    private readonly vault: TokenVaultService,
    private readonly billing: BillingService,
  ) {}

  /**
   * Completes the Google OAuth handshake for one business: stores the encrypted
   * tokens, then discovers every location the login can manage. New locations
   * start UNTICKED - nothing is synced or billed until the business picks them.
   */
  async connectFromCode(code: string, brandId: string): Promise<{ accountId: string; locationsFound: number }> {
    const brand = await this.prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) {
      throw new BadRequestException(`Business ${brandId} not found`);
    }

    const tokens = await this.oauth.exchangeCode(code);
    if (!tokens.refreshToken) {
      throw new BadRequestException(
        "Google did not return a refresh token. Remove the app from your Google account's third-party access and connect again.",
      );
    }

    const accounts = await this.google.listAccounts(tokens.accessToken);
    if (accounts.length === 0) {
      throw new BadRequestException("This Google login does not manage any Business Profile. Sign in as the profile's owner or manager.");
    }
    const accountEmail = accounts[0].accountName || accounts[0].name;

    // Idempotent per business and Google login: reconnecting updates the tokens
    // instead of creating a duplicate that would double-sync every location.
    const tokenData = {
      accessToken: this.vault.encrypt(tokens.accessToken),
      refreshToken: this.vault.encrypt(tokens.refreshToken),
      tokenExpiresAt: tokens.expiresAt,
      status: PlatformAccountStatus.CONNECTED,
    };
    const account = await this.prisma.platformAccount.upsert({
      where: { brandId_platform_accountEmail: { brandId, platform: Platform.GOOGLE, accountEmail } },
      update: tokenData,
      create: { brandId, accountEmail, ...tokenData },
    });

    const locationsFound = await this.discoverLocations(account, tokens.accessToken);
    // One Google login per business: connecting a different one replaces the
    // earlier login and drops the locations that only it could reach.
    await this.replaceOtherLogins(brandId, account.id);
    return { accountId: account.id, locationsFound };
  }

  /** Re-reads the Google login's locations (e.g. after the business adds one). */
  async refreshLocations(brandId: string): Promise<{ locationsFound: number }> {
    let total = 0;
    for (const account of await this.listConnected(brandId)) {
      total += await this.discoverLocations(account, await this.getValidAccessToken(account));
    }
    return { locationsFound: total };
  }

  /**
   * Lists every location under every Google account the login can manage and
   * links it to this business. Existing locations keep their tick; names and
   * links are refreshed from Google.
   */
  private async discoverLocations(account: PlatformAccount, accessToken: string): Promise<number> {
    const accounts = await this.google.listAccounts(accessToken);
    let found = 0;

    for (const acct of accounts) {
      const locations = await this.google.listLocations(accessToken, acct.name);
      for (const loc of locations) {
        const googleLocationId = loc.name.replace(/^locations\//, "");
        const resource = `${acct.name}/locations/${googleLocationId}`;
        const details = {
          name: loc.title || `Location ${googleLocationId}`,
          address: formatAddress(loc),
          mapsUri: loc.metadata?.mapsUri ?? null,
        };

        const location = await this.prisma.location.upsert({
          where: { brandId_googleLocationId: { brandId: account.brandId, googleLocationId } },
          update: details,
          create: { brandId: account.brandId, googleLocationId, ...details },
        });

        await this.prisma.platformLocation.upsert({
          where: {
            platformAccountId_externalLocationId: { platformAccountId: account.id, externalLocationId: resource },
          },
          update: { locationId: location.id },
          create: { platformAccountId: account.id, externalLocationId: resource, locationId: location.id },
        });
        found++;
      }
    }

    this.logger.log(`Business ${account.brandId}: found ${found} Google location(s) for account ${account.id}.`);
    return found;
  }

  /** Returns a currently-valid access token, refreshing and re-storing if needed. */
  async getValidAccessToken(account: PlatformAccount): Promise<string> {
    if (account.tokenExpiresAt.getTime() > Date.now()) {
      return this.vault.decrypt(account.accessToken);
    }

    const refreshToken = this.vault.decrypt(account.refreshToken);
    try {
      const refreshed = await this.oauth.refresh(refreshToken);
      await this.prisma.platformAccount.update({
        where: { id: account.id },
        data: {
          accessToken: this.vault.encrypt(refreshed.accessToken),
          tokenExpiresAt: refreshed.expiresAt,
          status: PlatformAccountStatus.CONNECTED,
        },
      });
      return refreshed.accessToken;
    } catch (error) {
      await this.prisma.platformAccount.update({
        where: { id: account.id },
        data: { status: PlatformAccountStatus.ERROR },
      });
      throw error;
    }
  }

  listConnected(brandId: string): Promise<PlatformAccount[]> {
    return this.prisma.platformAccount.findMany({ where: { brandId, status: PlatformAccountStatus.CONNECTED } });
  }

  async listForBrand(brandId: string) {
    const accounts = await this.prisma.platformAccount.findMany({
      where: { brandId, status: { not: PlatformAccountStatus.DISCONNECTED } },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { platformLocations: true } } },
    });
    return accounts.map((a) => ({
      id: a.id,
      accountEmail: a.accountEmail,
      status: a.status,
      connectedAt: a.createdAt,
      locationCount: a._count.platformLocations,
    }));
  }

  /** Disconnects a Google login: revokes it at Google and stops syncing it. */
  async disconnect(brandId: string, id: string): Promise<{ disconnected: true }> {
    const account = await this.findByIdOrThrow(brandId, id);
    try {
      await this.oauth.revoke(this.vault.decrypt(account.refreshToken));
    } catch (error) {
      this.logger.warn(`Google revoke failed for ${id} (continuing): ${error instanceof Error ? error.message : error}`);
    }
    await this.prisma.platformAccount.update({
      where: { id },
      data: { status: PlatformAccountStatus.DISCONNECTED, accessToken: "", refreshToken: "" },
    });
    await this.prisma.platformLocation.deleteMany({ where: { platformAccountId: id } });
    await this.removeOrphanLocations(brandId);
    return { disconnected: true };
  }

  /**
   * Revokes and removes every other Google login of the business, then drops
   * the locations nothing can reach any more (with their stored reviews), so
   * the dashboard only ever shows the Google account that is connected now.
   */
  private async replaceOtherLogins(brandId: string, keepAccountId: string): Promise<void> {
    const others = await this.prisma.platformAccount.findMany({ where: { brandId, id: { not: keepAccountId } } });
    for (const other of others) {
      if (other.status !== PlatformAccountStatus.DISCONNECTED && other.refreshToken) {
        try {
          await this.oauth.revoke(this.vault.decrypt(other.refreshToken));
        } catch (error) {
          this.logger.warn(`Google revoke failed for ${other.id} (continuing): ${error instanceof Error ? error.message : error}`);
        }
      }
    }
    if (others.length > 0) {
      // Cascades to the old login's location links.
      await this.prisma.platformAccount.deleteMany({ where: { brandId, id: { not: keepAccountId } } });
    }
    await this.removeOrphanLocations(brandId);
  }

  /** Deletes locations (and their reviews) that no connected Google login reaches. */
  private async removeOrphanLocations(brandId: string): Promise<void> {
    const { count } = await this.prisma.location.deleteMany({ where: { brandId, platformLocations: { none: {} } } });
    if (count > 0) {
      this.logger.log(`Business ${brandId}: removed ${count} location(s) no longer reachable by the connected Google login.`);
      // Billing is per ticked location, so keep it in step.
      await this.billing
        .syncQuantity(brandId)
        .catch((e) => this.logger.error(`Billing quantity update failed for ${brandId}: ${e instanceof Error ? e.message : e}`));
    }
  }

  async findByIdOrThrow(brandId: string, id: string): Promise<PlatformAccount> {
    const account = await this.prisma.platformAccount.findFirst({ where: { id, brandId } });
    if (!account) {
      throw new NotFoundException(`Google connection ${id} not found`);
    }
    return account;
  }
}

function formatAddress(loc: GoogleLocation): string | null {
  const a = loc.storefrontAddress;
  if (!a) return null;
  const parts = [...(a.addressLines ?? []), a.locality, a.administrativeArea, a.postalCode].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}
