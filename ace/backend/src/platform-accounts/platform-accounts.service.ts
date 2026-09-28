import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Platform, PlatformAccount, PlatformAccountStatus } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { APP_BRAND } from "../config/app-brand";
import { GoogleOAuthService } from "./google-oauth.service";
import { GoogleReviewsClient } from "./google-reviews.client";
import { resolveBrandName } from "./location-brand-map";
import { TokenVaultService } from "./token-vault.service";

/**
 * Owns the connected Google logins and their location links. Tokens are only
 * ever stored encrypted (via TokenVaultService) and only ever decrypted here.
 */
@Injectable()
export class PlatformAccountsService {
  private readonly logger = new Logger(PlatformAccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauth: GoogleOAuthService,
    private readonly google: GoogleReviewsClient,
    private readonly vault: TokenVaultService,
  ) {}

  /**
   * Completes the OAuth handshake: exchanges the code, stores the encrypted
   * tokens against the chosen brand, then discovers the Google locations and
   * links them so the sync job knows what to read.
   *
   * Only this brand's campuses are imported: the connected login is an agency account
   * that also manages unrelated businesses. Each campus is matched by its RTO
   * code and routed to the correct brand (see resolveBrandName), so the brand
   * chosen at connect time only owns the account record, not the routing.
   */
  async connectFromCode(code: string, brandId: string): Promise<{ accountId: string; locationsLinked: number }> {
    const brand = await this.prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) {
      throw new BadRequestException(`Brand ${brandId} not found`);
    }

    const tokens = await this.oauth.exchangeCode(code);
    if (!tokens.refreshToken) {
      // Without a refresh token the connection dies in an hour. This happens
      // when the user has consented before; forcing prompt=consent avoids it.
      throw new BadRequestException(
        "Google did not return a refresh token. Disconnect the app in the Google account's permissions and connect again.",
      );
    }

    const accounts = await this.google.listAccounts(tokens.accessToken);
    if (accounts.length === 0) {
      throw new BadRequestException("The connected Google login manages no Business Profile accounts.");
    }
    const accountEmail = accounts[0].accountName || accounts[0].name;

    // Idempotent by Google login: reconnecting the same account (or connecting
    // it from a different brand) updates the existing record and its tokens
    // instead of creating a duplicate that would double-sync every campus.
    const existing = await this.prisma.platformAccount.findFirst({
      where: { platform: Platform.GOOGLE, accountEmail },
    });
    const tokenData = {
      accessToken: this.vault.encrypt(tokens.accessToken),
      refreshToken: this.vault.encrypt(tokens.refreshToken),
      tokenExpiresAt: tokens.expiresAt,
      status: PlatformAccountStatus.CONNECTED,
    };
    const account = existing
      ? await this.prisma.platformAccount.update({ where: { id: existing.id }, data: tokenData })
      : await this.prisma.platformAccount.create({ data: { brandId, accountEmail, ...tokenData } });

    const locationsLinked = await this.discoverLocations(account, tokens.accessToken);
    return { accountId: account.id, locationsLinked };
  }

  /**
   * Lists Google locations and links only this brand's campuses, each routed to
   * its own brand by RTO code. Anything that is not a recognised campus is
   * skipped so unrelated agency businesses never enter the system.
   */
  private async discoverLocations(account: PlatformAccount, accessToken: string): Promise<number> {
    const accounts = await this.google.listAccounts(accessToken);
    const brandIdByName = new Map((await this.prisma.brand.findMany()).map((b) => [b.name, b.id]));
    let linked = 0;
    let skipped = 0;

    for (const acct of accounts) {
      const locations = await this.google.listLocations(accessToken, acct.name);
      for (const loc of locations) {
        const title = loc.title || "";
        const brandName = resolveBrandName(title);
        const brandId = brandName ? brandIdByName.get(brandName) : undefined;
        if (!brandId) {
          // Not one of this brand's campuses (or brand row missing) - skip it.
          skipped++;
          continue;
        }

        const locationId = loc.name.replace(/^locations\//, "");
        const resource = `${acct.name}/locations/${locationId}`;
        const localId = `gbp-${locationId}`;

        // brandId in update too, so a re-sync corrects a campus that was linked
        // to the wrong brand by an earlier run.
        await this.prisma.location.upsert({
          where: { id: localId },
          update: { name: title || `Location ${locationId}`, brandId },
          create: { id: localId, brandId, name: title || `Location ${locationId}` },
        });

        await this.prisma.platformLocation.upsert({
          where: {
            platformAccountId_externalLocationId: { platformAccountId: account.id, externalLocationId: resource },
          },
          update: { locationId: localId },
          create: { platformAccountId: account.id, externalLocationId: resource, locationId: localId },
        });
        linked++;
      }
    }

    this.logger.log(`Linked ${linked} ${APP_BRAND.name} campus(es) for account ${account.id}; skipped ${skipped} other location(s).`);
    return linked;
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

  listConnected(): Promise<PlatformAccount[]> {
    return this.prisma.platformAccount.findMany({ where: { status: PlatformAccountStatus.CONNECTED } });
  }

  /**
   * Connected accounts with the brands they actually cover, derived from their
   * linked campuses. One agency login commonly serves several brands, so the UI
   * must show coverage by campus rather than by the single brand chosen at
   * connect time.
   */
  async listConnectedWithCoverage() {
    const accounts = await this.prisma.platformAccount.findMany({
      where: { status: PlatformAccountStatus.CONNECTED },
      orderBy: { createdAt: "asc" },
      include: { platformLocations: { include: { location: { include: { brand: true } } } } },
    });

    return accounts.map((account) => {
      const byBrand = new Map<string, { brandId: string; brandName: string; locationCount: number }>();
      for (const link of account.platformLocations) {
        const brand = link.location.brand;
        const entry = byBrand.get(brand.id) ?? { brandId: brand.id, brandName: brand.name, locationCount: 0 };
        entry.locationCount++;
        byBrand.set(brand.id, entry);
      }
      return {
        id: account.id,
        accountEmail: account.accountEmail,
        status: account.status,
        connectedAt: account.createdAt,
        coverage: [...byBrand.values()].sort((a, b) => a.brandName.localeCompare(b.brandName)),
      };
    });
  }

  async findByIdOrThrow(id: string): Promise<PlatformAccount> {
    const account = await this.prisma.platformAccount.findUnique({ where: { id } });
    if (!account) {
      throw new NotFoundException(`Platform account ${id} not found`);
    }
    return account;
  }
}
