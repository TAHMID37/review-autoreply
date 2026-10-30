import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { BrandStatus, Prisma, Widget } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { BillingService } from "../billing/billing.service";
import { PrismaService } from "../common/prisma/prisma.service";
import { Env } from "../config/env.schema";
import { APP_ENV } from "../config/env.token";
import { isOriginAllowed, normaliseDomain } from "./allowed-domains";
import { CreateWidgetDto, UpdateWidgetDto } from "./widget.dto";

export interface WidgetFeed {
  businessName: string;
  layout: Widget["layout"];
  theme: Record<string, unknown>;
  averageRating: number;
  totalReviews: number;
  /** Link for the badge / "see all reviews" - the first location's Google listing. */
  googleUrl: string | null;
  reviews: {
    reviewerName: string;
    reviewerPhotoUrl: string | null;
    rating: number;
    text: string;
    reviewedAt: Date;
    locationName: string;
    googleUrl: string | null;
  }[];
}

@Injectable()
export class WidgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
    @Inject(APP_ENV) private readonly env: Env,
  ) {}

  list(brandId: string) {
    return this.prisma.widget.findMany({ where: { brandId }, orderBy: { createdAt: "asc" } });
  }

  async create(brandId: string, dto: CreateWidgetDto) {
    await this.assertLocations(brandId, dto.locationIds);
    return this.prisma.widget.create({
      data: {
        brandId,
        publicId: `wid_${randomBytes(6).toString("base64url")}`,
        name: dto.name,
        layout: dto.layout,
        locationIds: dto.locationIds,
        minRating: dto.minRating,
        maxReviews: dto.maxReviews,
        requireComment: dto.requireComment,
        theme: dto.theme ? { ...dto.theme } : undefined,
        allowedDomains: cleanDomains(dto.allowedDomains),
        enabled: dto.enabled,
      },
    });
  }

  async update(brandId: string, id: string, dto: UpdateWidgetDto) {
    await this.getOwned(brandId, id);
    await this.assertLocations(brandId, dto.locationIds);
    return this.prisma.widget.update({
      where: { id },
      data: {
        ...dto,
        theme: dto.theme ? { ...dto.theme } : undefined,
        allowedDomains: dto.allowedDomains ? cleanDomains(dto.allowedDomains) : undefined,
      },
    });
  }

  async remove(brandId: string, id: string) {
    await this.getOwned(brandId, id);
    await this.prisma.widget.delete({ where: { id } });
    return { deleted: true };
  }

  /** The embed snippet the business pastes into its website. */
  snippet(widget: Pick<Widget, "publicId">): string {
    const api = this.env.API_PUBLIC_URL.replace(/\/$/, "");
    return `<div class="ra-reviews" data-widget="${widget.publicId}"></div>\n<script src="${api}/widget/embed.js" async></script>`;
  }

  /**
   * The public review feed behind an embedded widget. Answers only for the
   * business's allowed websites (and our own dashboard, for the live preview).
   */
  async feed(publicId: string, origin: string | undefined): Promise<WidgetFeed> {
    const widget = await this.prisma.widget.findUnique({
      where: { publicId },
      include: { brand: { include: { subscription: true } } },
    });
    if (!widget || !widget.enabled || widget.brand.status !== BrandStatus.ACTIVE) {
      throw new NotFoundException("Widget not found");
    }
    if (!this.isPreviewOrigin(origin) && !isOriginAllowed(origin, widget.allowedDomains)) {
      throw new ForbiddenException("This website is not on the widget's list of allowed websites.");
    }
    if (!this.billing.isServiceActive(widget.brand.subscription)) {
      throw new ForbiddenException("Widget paused");
    }

    const locationWhere: Prisma.LocationWhereInput = {
      brandId: widget.brandId,
      syncEnabled: true,
      ...(widget.locationIds.length ? { id: { in: widget.locationIds } } : {}),
    };
    const base: Prisma.ReviewWhereInput = { removedAt: null, location: locationWhere };

    const [aggregate, reviews, firstLocation] = await Promise.all([
      this.prisma.review.aggregate({ where: base, _avg: { rating: true }, _count: true }),
      this.prisma.review.findMany({
        where: {
          ...base,
          rating: { gte: widget.minRating },
          ...(widget.requireComment ? { NOT: { reviewText: "" } } : {}),
        },
        include: { location: { select: { name: true, mapsUri: true } } },
        orderBy: { reviewedAt: "desc" },
        take: widget.maxReviews,
      }),
      this.prisma.location.findFirst({ where: locationWhere, orderBy: { name: "asc" }, select: { mapsUri: true } }),
    ]);

    return {
      businessName: widget.brand.name,
      layout: widget.layout,
      theme: (widget.theme as Record<string, unknown> | null) ?? {},
      averageRating: Math.round((aggregate._avg.rating ?? 0) * 10) / 10,
      totalReviews: aggregate._count,
      googleUrl: firstLocation?.mapsUri ?? null,
      reviews: reviews.map((r) => ({
        reviewerName: r.reviewerName,
        reviewerPhotoUrl: r.reviewerPhotoUrl,
        rating: r.rating,
        text: r.reviewText,
        reviewedAt: r.reviewedAt,
        locationName: r.location.name,
        googleUrl: r.location.mapsUri,
      })),
    };
  }

  /** Our own dashboard (the widget editor's live preview). */
  isPreviewOrigin(origin: string | undefined): boolean {
    if (!origin) return false;
    try {
      return new URL(origin).origin === new URL(this.env.WEB_APP_URL).origin;
    } catch {
      return false;
    }
  }

  private async getOwned(brandId: string, id: string): Promise<Widget> {
    const widget = await this.prisma.widget.findFirst({ where: { id, brandId } });
    if (!widget) throw new NotFoundException(`Widget ${id} not found`);
    return widget;
  }

  private async assertLocations(brandId: string, ids?: string[]) {
    if (!ids?.length) return;
    const count = await this.prisma.location.count({ where: { id: { in: ids }, brandId } });
    if (count !== new Set(ids).size) throw new BadRequestException("One or more locations do not belong to this business.");
  }
}

function cleanDomains(input?: string[]): string[] | undefined {
  if (!input) return undefined;
  const cleaned = input.map(normaliseDomain);
  const bad = input.filter((_, i) => cleaned[i] === null);
  if (bad.length) throw new BadRequestException(`Not a website address: ${bad.join(", ")}`);
  return [...new Set(cleaned as string[])];
}
