import { BadRequestException, Controller, Delete, Get, Inject, Param, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthUserDto } from "../auth/dto/auth-user.dto";
import { AdminGuard } from "../auth/guards/admin.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SignedStateService } from "../common/crypto/signed-state.service";
import { Env } from "../config/env.schema";
import { APP_ENV } from "../config/env.token";
import { GoogleOAuthService } from "./google-oauth.service";
import { PlatformAccountsService } from "./platform-accounts.service";
import { ReviewPosterService } from "./review-poster.service";
import { ReviewsSyncService } from "./reviews-sync.service";

const STATE_PURPOSE = "google-connect";
/** Where the browser lands after Google: only these dashboard pages. */
const RETURN_PAGES = new Set(["setup", "settings"]);

@Controller("platform-accounts")
export class PlatformAccountsController {
  constructor(
    private readonly oauth: GoogleOAuthService,
    private readonly accounts: PlatformAccountsService,
    private readonly sync: ReviewsSyncService,
    private readonly poster: ReviewPosterService,
    private readonly state: SignedStateService,
    @Inject(APP_ENV) private readonly env: Env,
  ) {}

  /** The Google consent URL for the signed-in business. */
  @Get("google/connect")
  @UseGuards(JwtAuthGuard, AdminGuard)
  connect(@CurrentUser() user: AuthUserDto, @Query("return") returnTo?: string): { authUrl: string } {
    const page = returnTo && RETURN_PAGES.has(returnTo) ? returnTo : "settings";
    return { authUrl: this.oauth.buildAuthUrl(this.state.sign(STATE_PURPOSE, { b: user.brandId, r: page })) };
  }

  /** Google's OAuth redirect. Public; the business is carried in signed state. */
  @Get("google/callback")
  async callback(@Query("code") code: string, @Query("state") state: string, @Res() res: Response): Promise<void> {
    const web = this.env.WEB_APP_URL.replace(/\/$/, "");
    let page = "settings";
    try {
      if (!code || !state) {
        throw new BadRequestException("Missing code or state");
      }
      const { b: brandId, r } = this.state.verify(STATE_PURPOSE, state);
      if (r && RETURN_PAGES.has(r)) page = r;
      const result = await this.accounts.connectFromCode(code, brandId);
      res.redirect(`${web}/${page}?connected=1&locations=${result.locationsFound}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "connection failed";
      res.redirect(`${web}/${page}?connected=0&error=${encodeURIComponent(message)}`);
    }
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@CurrentUser() user: AuthUserDto) {
    return this.accounts.listForBrand(user.brandId);
  }

  @Post("refresh-locations")
  @UseGuards(JwtAuthGuard)
  refreshLocations(@CurrentUser() user: AuthUserDto) {
    return this.accounts.refreshLocations(user.brandId);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, AdminGuard)
  disconnect(@CurrentUser() user: AuthUserDto, @Param("id") id: string) {
    return this.accounts.disconnect(user.brandId, id);
  }

  /** "Sync now" for the signed-in business. */
  @Post("sync")
  @UseGuards(JwtAuthGuard)
  runSync(@CurrentUser() user: AuthUserDto) {
    return this.sync.syncBrandById(user.brandId);
  }

  /** Post one reply to Google now. */
  @Post("replies/:id/post")
  @UseGuards(JwtAuthGuard)
  postReply(@CurrentUser() user: AuthUserDto, @Param("id") id: string) {
    return this.poster.postReply(user.brandId, id);
  }
}
