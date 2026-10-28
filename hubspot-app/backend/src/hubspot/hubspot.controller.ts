import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Query, Res, UseGuards } from "@nestjs/common";
import { IsBoolean, IsOptional } from "class-validator";
import type { Response } from "express";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthUserDto } from "../auth/dto/auth-user.dto";
import { AdminGuard } from "../auth/guards/admin.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SignedStateService } from "../common/crypto/signed-state.service";
import { Env } from "../config/env.schema";
import { APP_ENV } from "../config/env.token";
import { HubSpotInstallService } from "./hubspot-install.service";
import { HubSpotOAuthService } from "./hubspot-oauth.service";

class UninstallDto {
  @IsOptional()
  @IsBoolean()
  deleteData?: boolean;
}

const STATE_PURPOSE = "hubspot-login";

@Controller("hubspot")
export class HubSpotController {
  constructor(
    private readonly oauth: HubSpotOAuthService,
    private readonly install: HubSpotInstallService,
    private readonly state: SignedStateService,
    @Inject(APP_ENV) private readonly env: Env,
  ) {}

  /**
   * The app's install URL (what the Marketplace "Install" button and the
   * private beta link point to) and the dashboard's "Sign in with HubSpot".
   */
  @Get("install")
  start(@Res() res: Response): void {
    res.redirect(this.oauth.buildAuthUrl(this.state.sign(STATE_PURPOSE, {})));
  }

  /**
   * HubSpot's OAuth redirect. Creates or refreshes the business, signs the
   * user in and hands the dashboard a one-time code (never the session itself).
   *
   * Installs started from the Marketplace arrive without our `state`; those
   * are accepted because the code can only be exchanged with our client secret
   * and redirect URI.
   */
  @Get("oauth/callback")
  async callback(
    @Query("code") code: string,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const web = this.env.WEB_APP_URL.replace(/\/$/, "");
    try {
      if (error) throw new Error(error === "access_denied" ? "HubSpot access was not granted." : error);
      if (!code) throw new Error("HubSpot did not return an authorisation code.");
      if (state) this.state.verify(STATE_PURPOSE, state);
      const result = await this.install.completeOAuth(code);
      const next = result.isNewBusiness ? "/setup" : "/dashboard";
      res.redirect(`${web}/auth/callback?code=${encodeURIComponent(result.loginCode)}&next=${encodeURIComponent(next)}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sign-in failed";
      res.redirect(`${web}/login?error=${encodeURIComponent(message)}`);
    }
  }

  /** Removes the app from this HubSpot account (admins only). */
  @Post("uninstall")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  async uninstall(@CurrentUser() user: AuthUserDto, @Body() dto: UninstallDto) {
    await this.install.uninstall(user.brandId, dto.deleteData === true);
    return { uninstalled: true, dataDeleted: dto.deleteData === true };
  }
}
