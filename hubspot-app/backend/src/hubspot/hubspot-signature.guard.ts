import { CanActivate, ExecutionContext, Inject, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { BrandStatus } from "@prisma/client";
import type { Request } from "express";
import { PrismaService } from "../common/prisma/prisma.service";
import { Env } from "../config/env.schema";
import { APP_ENV } from "../config/env.token";
import { verifyHubSpotSignatureV3 } from "./hubspot-signature";

/** What a signed request from inside HubSpot tells us about who is asking. */
export interface HubSpotRequestContext {
  brandId: string;
  portalId: string;
  hubspotUserId: string | null;
  userEmail: string | null;
}

export type HubSpotSignedRequest = Request & { hubspot: HubSpotRequestContext; rawBody?: Buffer };

/**
 * Protects the endpoints our HubSpot app cards call with `hubspot.fetch()`.
 * HubSpot signs each request with our client secret and appends the portal and
 * user ids, so a valid signature proves the call came from our app inside that
 * HubSpot account - no session token needed.
 *
 * The signed URI is rebuilt from API_PUBLIC_URL, because behind a proxy the
 * host/protocol Express sees is not the one HubSpot called. The proxy must not
 * strip a path prefix.
 */
@Injectable()
export class HubSpotSignatureGuard implements CanActivate {
  private readonly logger = new Logger(HubSpotSignatureGuard.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_ENV) private readonly env: Env,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<HubSpotSignedRequest>();
    const uri = `${this.env.API_PUBLIC_URL.replace(/\/$/, "")}${req.originalUrl}`;
    const result = verifyHubSpotSignatureV3({
      clientSecret: this.env.HUBSPOT_CLIENT_SECRET,
      method: req.method,
      uri,
      body: req.rawBody ? req.rawBody.toString("utf8") : "",
      timestamp: header(req, "x-hubspot-request-timestamp"),
      signature: header(req, "x-hubspot-signature-v3"),
    });
    if (!result.ok) {
      this.logger.warn(`Rejected HubSpot request to ${req.originalUrl}: ${result.reason}`);
      throw new UnauthorizedException("Invalid HubSpot signature");
    }

    const portalId = String(req.query.portalId ?? "");
    const brand = portalId
      ? await this.prisma.brand.findUnique({ where: { hubspotPortalId: portalId }, select: { id: true, status: true } })
      : null;
    if (!brand || brand.status !== BrandStatus.ACTIVE) {
      throw new UnauthorizedException("The app is not set up for this HubSpot account yet.");
    }

    req.hubspot = {
      brandId: brand.id,
      portalId,
      hubspotUserId: req.query.userId ? String(req.query.userId) : null,
      userEmail: req.query.userEmail ? String(req.query.userEmail) : null,
    };
    return true;
  }
}

function header(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}
