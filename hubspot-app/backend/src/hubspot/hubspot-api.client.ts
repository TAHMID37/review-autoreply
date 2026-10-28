import { Injectable, Logger } from "@nestjs/common";
import { BrandStatus, HubSpotInstallation, HubSpotInstallStatus } from "@prisma/client";
import { TokenVaultService } from "../common/crypto/token-vault.service";
import { PrismaService } from "../common/prisma/prisma.service";
import { HubSpotAccessRevokedError, HubSpotOAuthService } from "./hubspot-oauth.service";

const API_BASE = "https://api.hubapi.com";

/** HubSpot's search endpoints allow 5 requests/second per account, shared by
 *  every app in it. Staying a little under leaves room for the others. */
const SEARCH_MIN_GAP_MS = 250;
const MAX_ATTEMPTS = 4;

export class HubSpotApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
  }
}

/** The business has no live HubSpot connection (uninstalled or revoked). */
export class HubSpotNotInstalledError extends Error {}

/**
 * Authorised calls to one business's HubSpot account. Handles token refresh,
 * rate limiting (429 + Retry-After) and transient 5xx retries, and marks the
 * installation UNINSTALLED when HubSpot refuses the refresh token - which is
 * how we learn the app was removed from HubSpot.
 */
@Injectable()
export class HubSpotApiClient {
  private readonly logger = new Logger(HubSpotApiClient.name);
  private readonly lastSearchAt = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauth: HubSpotOAuthService,
    private readonly vault: TokenVaultService,
  ) {}

  async request<T>(brandId: string, method: string, path: string, body?: unknown): Promise<T> {
    let installation = await this.getInstallation(brandId);
    let token = await this.getValidAccessToken(installation);
    let refreshedAfter401 = false;

    for (let attempt = 1; ; attempt++) {
      if (path.endsWith("/search")) {
        await this.searchGate(brandId);
      }

      const response = await fetch(`${API_BASE}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      if (response.status === 401 && !refreshedAfter401) {
        // Token revoked or expired early - refresh once and retry.
        refreshedAfter401 = true;
        installation = await this.getInstallation(brandId);
        token = await this.getValidAccessToken(installation, true);
        continue;
      }

      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt < MAX_ATTEMPTS) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt;
        this.logger.warn(`HubSpot ${method} ${path} -> ${response.status}; retrying in ${waitMs}ms`);
        await sleep(waitMs);
        continue;
      }

      if (response.status === 204) {
        return undefined as T;
      }
      const text = await response.text();
      const json = text ? safeJson(text) : undefined;
      if (!response.ok) {
        const message = (json as { message?: string } | undefined)?.message ?? text.slice(0, 300);
        throw new HubSpotApiError(response.status, `HubSpot ${method} ${path} failed (${response.status}): ${message}`, json);
      }
      return json as T;
    }
  }

  async getInstallation(brandId: string): Promise<HubSpotInstallation> {
    const installation = await this.prisma.hubSpotInstallation.findUnique({ where: { brandId } });
    if (!installation || installation.status !== HubSpotInstallStatus.INSTALLED) {
      throw new HubSpotNotInstalledError("This business does not have the app installed in HubSpot.");
    }
    return installation;
  }

  private async getValidAccessToken(installation: HubSpotInstallation, force = false): Promise<string> {
    if (!force && installation.tokenExpiresAt.getTime() > Date.now()) {
      return this.vault.decrypt(installation.accessToken);
    }
    try {
      const refreshed = await this.oauth.refresh(this.vault.decrypt(installation.refreshToken));
      await this.prisma.hubSpotInstallation.update({
        where: { id: installation.id },
        data: {
          accessToken: this.vault.encrypt(refreshed.accessToken),
          refreshToken: this.vault.encrypt(refreshed.refreshToken),
          tokenExpiresAt: refreshed.expiresAt,
        },
      });
      return refreshed.accessToken;
    } catch (error) {
      if (error instanceof HubSpotAccessRevokedError) {
        await this.markUninstalled(installation.brandId, "HubSpot refused the refresh token");
        throw new HubSpotNotInstalledError("HubSpot access was removed for this business.");
      }
      throw error;
    }
  }

  /**
   * Records that the app is no longer installed. Stops syncing, switches off
   * auto-replies and keeps the business's data (they may reinstall). Deleting
   * the data is a separate, explicit request.
   */
  async markUninstalled(brandId: string, reason: string): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.hubSpotInstallation.updateMany({
        where: { brandId },
        data: { status: HubSpotInstallStatus.UNINSTALLED, uninstalledAt: now },
      }),
      this.prisma.brand.update({
        where: { id: brandId },
        data: { status: BrandStatus.UNINSTALLED, uninstalledAt: now, autoReplyEnabled: false },
      }),
    ]);
    this.logger.warn(`Business ${brandId} marked uninstalled: ${reason}`);
  }

  private async searchGate(brandId: string): Promise<void> {
    const last = this.lastSearchAt.get(brandId) ?? 0;
    const wait = last + SEARCH_MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    this.lastSearchAt.set(brandId, Date.now());
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
