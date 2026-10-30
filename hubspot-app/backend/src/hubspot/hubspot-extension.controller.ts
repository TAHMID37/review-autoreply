import { Body, Controller, Get, HttpCode, HttpStatus, Inject, NotFoundException, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ReplyStatus } from "@prisma/client";
import { IsOptional, IsString, MinLength } from "class-validator";
import { PrismaService } from "../common/prisma/prisma.service";
import { Env } from "../config/env.schema";
import { APP_ENV } from "../config/env.token";
import { RepliesService } from "../replies/replies.service";
import { UsersService } from "../users/users.service";
import { HubSpotSignatureGuard, HubSpotSignedRequest } from "./hubspot-signature.guard";

class CardApproveDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  finalReply?: string;
}

/**
 * Endpoints for the app's UI inside HubSpot (the "Google reviews" tab on a
 * contact record, and the app home page). Called with `hubspot.fetch()` and
 * authenticated by HubSpot's request signature - see HubSpotSignatureGuard.
 */
@Controller("hubspot/ext")
@UseGuards(HubSpotSignatureGuard)
export class HubSpotExtensionController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly replies: RepliesService,
    private readonly users: UsersService,
    @Inject(APP_ENV) private readonly env: Env,
  ) {}

  /** The Google reviews saved under one contact. */
  @Get("contact-reviews")
  async contactReviews(@Req() req: HubSpotSignedRequest, @Query("objectId") objectId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { hubspotContactId: String(objectId ?? ""), location: { brandId: req.hubspot.brandId } },
      include: { location: { select: { name: true, mapsUri: true } }, reply: true },
      orderBy: { reviewedAt: "desc" },
      take: 50,
    });
    return {
      dashboardUrl: this.dashboardUrl("/reviews"),
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        text: r.reviewText,
        reviewerName: r.reviewerName,
        reviewedAt: r.reviewedAt,
        locationName: r.location.name,
        googleUrl: r.location.mapsUri,
        removed: r.removedAt !== null,
        possibleDuplicate: r.hubspotMatch === "CREATED_AMBIGUOUS",
        reply: r.reply
          ? {
              id: r.reply.id,
              status: r.reply.status,
              text: r.reply.finalReply?.trim() || r.reply.aiDraft,
              postedAt: r.reply.postedAt,
              autoPostAt: r.reply.autoPostAt,
            }
          : null,
      })),
    };
  }

  /** Headline numbers and setup progress for the app home page. */
  @Get("summary")
  async summary(@Req() req: HubSpotSignedRequest) {
    const brandId = req.hubspot.brandId;
    const where = { location: { brandId }, removedAt: null };
    const [brand, total, avg, pending, posted, syncedLocations, googleConnected] = await Promise.all([
      this.prisma.brand.findUniqueOrThrow({
        where: { id: brandId },
        select: { name: true, autoReplyEnabled: true, subscription: { select: { status: true } } },
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.aggregate({ where, _avg: { rating: true } }),
      this.prisma.review.count({ where: { ...where, reply: { status: ReplyStatus.PENDING_APPROVAL } } }),
      this.prisma.review.count({ where: { ...where, reply: { status: ReplyStatus.POSTED } } }),
      this.prisma.location.count({ where: { brandId, syncEnabled: true } }),
      this.prisma.platformAccount.count({ where: { brandId, status: "CONNECTED" } }),
    ]);
    return {
      businessName: brand.name,
      totalReviews: total,
      averageRating: Math.round((avg._avg.rating ?? 0) * 10) / 10,
      pendingApproval: pending,
      responseRate: total ? Math.round((posted / total) * 100) : 0,
      setup: {
        googleConnected: googleConnected > 0,
        locationsSelected: syncedLocations,
        autoReplyEnabled: brand.autoReplyEnabled,
        billingStatus: brand.subscription?.status ?? "NONE",
      },
      dashboardUrl: this.dashboardUrl("/dashboard"),
      setupUrl: this.dashboardUrl("/setup"),
      alertsUrl: this.dashboardUrl("/alerts"),
    };
  }

  /** Approve a held reply straight from the contact record. */
  @Post("replies/:id/approve")
  @HttpCode(HttpStatus.OK)
  async approve(@Req() req: HubSpotSignedRequest, @Param("id") id: string, @Body() dto: CardApproveDto) {
    if (!req.hubspot.userEmail) {
      throw new NotFoundException("HubSpot did not say which user is approving.");
    }
    const user = await this.users.upsertFromHubSpot(req.hubspot.brandId, {
      hubspotUserId: req.hubspot.hubspotUserId,
      email: req.hubspot.userEmail,
    });
    const reply = await this.replies.approve(req.hubspot.brandId, id, user.id, dto.finalReply);
    return { id: reply.id, status: reply.status };
  }

  private dashboardUrl(path: string): string {
    return `${this.env.WEB_APP_URL.replace(/\/$/, "")}/login?next=${encodeURIComponent(path)}`;
  }
}
