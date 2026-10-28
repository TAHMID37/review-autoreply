import { Inject, Injectable, Logger } from "@nestjs/common";
import { Env } from "../config/env.schema";
import { APP_ENV } from "../config/env.token";

const AUTHORIZE_URL = "https://app.hubspot.com/oauth/authorize";
/** HubSpot's dated OAuth endpoints. New Marketplace listings must use these
 *  rather than the deprecated /oauth/v1 ones. */
const TOKEN_URL = "https://api.hubapi.com/oauth/2026-03/token";
const INTROSPECT_URL = "https://api.hubapi.com/oauth/2026-03/token/introspect";
/** Deprecated, used only if introspection is unavailable. */
const LEGACY_TOKEN_INFO_URL = "https://api.hubapi.com/oauth/v1/access-tokens";

export interface HubSpotTokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

/** Who and which account a HubSpot access token belongs to. */
export interface HubSpotTokenInfo {
  portalId: string;
  hubDomain?: string;
  userEmail: string;
  hubspotUserId: string | null;
  scopes: string[];
}

/** Thrown when HubSpot refuses a refresh token - the app was uninstalled or
 *  access was revoked. Callers mark the installation UNINSTALLED. */
export class HubSpotAccessRevokedError extends Error {}

/**
 * The HubSpot OAuth handshake only: consent URL, code exchange, refresh and
 * token introspection. Never touches the database.
 */
@Injectable()
export class HubSpotOAuthService {
  private readonly logger = new Logger(HubSpotOAuthService.name);

  constructor(@Inject(APP_ENV) private readonly env: Env) {}

  buildAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.env.HUBSPOT_CLIENT_ID,
      redirect_uri: this.env.HUBSPOT_OAUTH_REDIRECT_URI,
      scope: this.env.HUBSPOT_SCOPES.trim(),
      state,
    });
    if (this.env.HUBSPOT_OPTIONAL_SCOPES.trim()) {
      params.set("optional_scope", this.env.HUBSPOT_OPTIONAL_SCOPES.trim());
    }
    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  exchangeCode(code: string): Promise<HubSpotTokenSet> {
    return this.tokenRequest({
      grant_type: "authorization_code",
      client_id: this.env.HUBSPOT_CLIENT_ID,
      client_secret: this.env.HUBSPOT_CLIENT_SECRET,
      redirect_uri: this.env.HUBSPOT_OAUTH_REDIRECT_URI,
      code,
    });
  }

  async refresh(refreshToken: string): Promise<HubSpotTokenSet> {
    try {
      return await this.tokenRequest({
        grant_type: "refresh_token",
        client_id: this.env.HUBSPOT_CLIENT_ID,
        client_secret: this.env.HUBSPOT_CLIENT_SECRET,
        refresh_token: refreshToken,
      });
    } catch (error) {
      if (error instanceof TokenHttpError && (error.status === 400 || error.status === 401)) {
        throw new HubSpotAccessRevokedError(error.message);
      }
      throw error;
    }
  }

  /** Looks up the account and user behind an access token. */
  async getTokenInfo(accessToken: string): Promise<HubSpotTokenInfo> {
    const introspected = await this.introspect(accessToken).catch((e) => {
      this.logger.warn(`Token introspection failed, trying the legacy endpoint: ${e instanceof Error ? e.message : e}`);
      return null;
    });
    const raw = introspected ?? (await this.legacyTokenInfo(accessToken));

    const portalId = raw.hub_id ?? raw.hubId;
    const userEmail = raw.user ?? raw.user_email;
    if (!portalId || !userEmail) {
      throw new Error("HubSpot did not say which account and user this sign-in belongs to.");
    }
    const userId = raw.user_id ?? raw.userId;
    return {
      portalId: String(portalId),
      hubDomain: raw.hub_domain,
      userEmail: String(userEmail),
      hubspotUserId: userId != null ? String(userId) : null,
      scopes: Array.isArray(raw.scopes) ? raw.scopes : typeof raw.scope === "string" ? raw.scope.split(" ") : [],
    };
  }

  private async introspect(accessToken: string): Promise<RawTokenInfo> {
    const response = await fetch(INTROSPECT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token: accessToken,
        client_id: this.env.HUBSPOT_CLIENT_ID,
        client_secret: this.env.HUBSPOT_CLIENT_SECRET,
      }).toString(),
    });
    const json = (await response.json().catch(() => ({}))) as RawTokenInfo;
    if (!response.ok || json.active === false) {
      throw new Error(`introspect HTTP ${response.status}`);
    }
    return json;
  }

  private async legacyTokenInfo(accessToken: string): Promise<RawTokenInfo> {
    const response = await fetch(`${LEGACY_TOKEN_INFO_URL}/${encodeURIComponent(accessToken)}`);
    const json = (await response.json().catch(() => ({}))) as RawTokenInfo;
    if (!response.ok) {
      throw new Error(`HubSpot token lookup failed (HTTP ${response.status})`);
    }
    return json;
  }

  private async tokenRequest(body: Record<string, string>): Promise<HubSpotTokenSet> {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
    });
    const json = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      message?: string;
      error?: string;
      error_description?: string;
    };
    if (!response.ok || !json.access_token || !json.refresh_token) {
      const detail = json.error_description || json.message || json.error || `HTTP ${response.status}`;
      throw new TokenHttpError(response.status, `HubSpot token request failed: ${detail}`);
    }
    // Refresh a minute early so an in-flight call never uses an expired token.
    const expiresAt = new Date(Date.now() + ((json.expires_in ?? 1800) - 60) * 1000);
    return { accessToken: json.access_token, refreshToken: json.refresh_token, expiresAt };
  }
}

class TokenHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface RawTokenInfo {
  active?: boolean;
  hub_id?: number | string;
  hubId?: number | string;
  hub_domain?: string;
  user?: string;
  user_email?: string;
  user_id?: number | string;
  userId?: number | string;
  scopes?: string[];
  scope?: string;
}
