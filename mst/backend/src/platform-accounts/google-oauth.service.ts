import { Inject, Injectable, Logger } from "@nestjs/common";
import { Env } from "../config/env.schema";
import { APP_ENV } from "../config/env.token";

/** The single scope needed to read (and later reply to) Google reviews. */
export const GOOGLE_BUSINESS_SCOPE = "https://www.googleapis.com/auth/business.manage";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export interface GoogleTokenSet {
  accessToken: string;
  /** Only returned on the first consent (access_type=offline, prompt=consent). */
  refreshToken?: string;
  expiresAt: Date;
}

/**
 * Handles the Google OAuth handshake only. It never touches the database or
 * decrypts stored tokens - that is PlatformAccountsService's job.
 */
@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);

  constructor(@Inject(APP_ENV) private readonly env: Env) {}

  /** URL to send the user to so they can grant access. `state` is echoed back. */
  buildAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.env.GOOGLE_CLIENT_ID,
      redirect_uri: this.env.GOOGLE_OAUTH_REDIRECT_URI,
      response_type: "code",
      scope: GOOGLE_BUSINESS_SCOPE,
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent",
      state,
    });
    return `${AUTH_ENDPOINT}?${params.toString()}`;
  }

  /** Exchanges the one-time authorization code for tokens. */
  async exchangeCode(code: string): Promise<GoogleTokenSet> {
    return this.tokenRequest({
      code,
      client_id: this.env.GOOGLE_CLIENT_ID,
      client_secret: this.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: this.env.GOOGLE_OAUTH_REDIRECT_URI,
      grant_type: "authorization_code",
    });
  }

  /** Uses a stored refresh token to mint a fresh access token. */
  async refresh(refreshToken: string): Promise<GoogleTokenSet> {
    return this.tokenRequest({
      refresh_token: refreshToken,
      client_id: this.env.GOOGLE_CLIENT_ID,
      client_secret: this.env.GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
    });
  }

  private async tokenRequest(body: Record<string, string>): Promise<GoogleTokenSet> {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
    });

    const json = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (!response.ok || !json.access_token) {
      const detail = json.error_description || json.error || `HTTP ${response.status}`;
      throw new Error(`Google token request failed: ${detail}`);
    }

    // Refresh a minute early so an in-flight call never uses an expired token.
    const expiresInSec = json.expires_in ?? 3600;
    const expiresAt = new Date(Date.now() + (expiresInSec - 60) * 1000);

    return { accessToken: json.access_token, refreshToken: json.refresh_token, expiresAt };
  }
}
