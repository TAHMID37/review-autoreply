import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Brand, BrandStatus, HubSpotInstallStatus, JobStatus, Platform } from "@prisma/client";
import { BillingService } from "../billing/billing.service";
import { PrismaService } from "../common/prisma/prisma.service";
import { Env } from "../config/env.schema";
import { APP_ENV } from "../config/env.token";
import { HubSpotNotInstalledError } from "../hubspot/hubspot-api.client";
import { HubSpotCrmService } from "../hubspot/hubspot-crm.service";
import { ReviewProcessorService } from "../reviews/review-processor.service";
import { ReviewsService } from "../reviews/reviews.service";
import { GoogleReviewsClient } from "./google-reviews.client";
import { PlatformAccountsService } from "./platform-accounts.service";
import { ReviewPosterService } from "./review-poster.service";

export interface SyncSummary {
  businessesSynced: number;
  accountsSynced: number;
  reviewsSeen: number;
  created: number;
  updated: number;
  removed: number;
  repliedOnGoogle: number;
  processed: number;
  failed: number;
  posted: number;
  savedToHubSpot: number;
}

/**
 * The 15-minute cycle, per business: pull Google reviews for the ticked
 * locations -> store new/edited ones -> draft replies -> post what is due ->
 * save changed reviews under HubSpot contacts.
 *
 * One business failing (revoked Google access, HubSpot outage) is logged and
 * skipped - it never stops the others from syncing.
 */
@Injectable()
export class ReviewsSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReviewsSyncService.name);
  private timer?: NodeJS.Timeout;
  private readonly running = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: PlatformAccountsService,
    private readonly google: GoogleReviewsClient,
    private readonly reviews: ReviewsService,
    private readonly processor: ReviewProcessorService,
    private readonly poster: ReviewPosterService,
    private readonly crm: HubSpotCrmService,
    private readonly billing: BillingService,
    @Inject(APP_ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    if (!this.env.REVIEW_SYNC_ENABLED) {
      this.logger.log("Scheduled review sync is off (set REVIEW_SYNC_ENABLED=true to enable).");
      return;
    }
    const everyMs = this.env.REVIEW_SYNC_INTERVAL_MIN * 60 * 1000;
    this.logger.log(`Scheduled review sync every ${this.env.REVIEW_SYNC_INTERVAL_MIN} min.`);
    this.timer = setInterval(() => {
      this.syncAll().catch((e) => this.logger.error(`Scheduled sync failed: ${e instanceof Error ? e.message : e}`));
    }, everyMs);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Every installed, paid-up business. */
  async syncAll(): Promise<SyncSummary> {
    const total = emptySummary();
    const brands = await this.prisma.brand.findMany({
      where: { status: BrandStatus.ACTIVE, ...(await this.billing.activeBrandFilter()) },
      orderBy: { createdAt: "asc" },
    });
    for (const brand of brands) {
      try {
        const s = await this.syncBrand(brand);
        for (const key of Object.keys(total) as (keyof SyncSummary)[]) total[key] += s[key];
      } catch (error) {
        this.logger.error(`Sync failed for business ${brand.id}: ${error instanceof Error ? error.message : error}`);
      }
    }
    return total;
  }

  async syncBrandById(brandId: string): Promise<SyncSummary> {
    const brand = await this.prisma.brand.findUniqueOrThrow({ where: { id: brandId }, include: { subscription: true } });
    if (!this.billing.isServiceActive(brand.subscription)) {
      throw new Error("Syncing is paused until billing is sorted out. Check the Billing page.");
    }
    return this.syncBrand(brand);
  }

  private async syncBrand(brand: Brand): Promise<SyncSummary> {
    const summary = emptySummary();
    if (this.running.has(brand.id)) {
      this.logger.warn(`Sync already running for ${brand.id} - skipping.`);
      return summary;
    }
    this.running.add(brand.id);
    const job = await this.prisma.jobRunLog.create({ data: { jobName: "review-sync", brandId: brand.id } });

    try {
      for (const account of await this.accounts.listConnected(brand.id)) {
        const token = await this.accounts.getValidAccessToken(account);
        const links = await this.prisma.platformLocation.findMany({
          where: { platformAccountId: account.id, location: { syncEnabled: true } },
        });

        for (const link of links) {
          const { accountName, locationName } = splitResource(link.externalLocationId);
          const { reviews, allExternalIds, answered } = await this.google.listReviews(token, accountName, locationName);
          for (const r of reviews) {
            summary.reviewsSeen++;
            const outcome = await this.reviews.upsertFromPlatform({
              platform: Platform.GOOGLE,
              locationId: link.locationId,
              externalReviewId: r.externalReviewId,
              reviewerName: r.reviewerName,
              reviewerPhotoUrl: r.reviewerPhotoUrl,
              rating: r.rating,
              reviewText: r.reviewText,
              reviewedAt: r.reviewedAt,
            });
            if (outcome.outcome === "created") summary.created++;
            else if (outcome.outcome === "updated") summary.updated++;
          }
          // Reviews already answered on Google get that reply recorded before
          // drafting runs, so they are never drafted or posted twice.
          summary.repliedOnGoogle += await this.reviews.markRepliedOnGoogle(link.locationId, answered);
          // Guarded on a non-empty response so a transient empty fetch never
          // hides all of a location's reviews.
          if (allExternalIds.length > 0) {
            summary.removed += await this.reviews.reconcileRemoved(link.locationId, allExternalIds);
          }
        }
        summary.accountsSynced++;
      }

      const drafted = await this.processor.processPending(brand.id);
      summary.processed = drafted.processed;
      summary.failed = drafted.failed;

      summary.posted = (await this.poster.postDue(brand)).posted;

      summary.savedToHubSpot = await this.saveToHubSpot(brand);
      summary.businessesSynced = 1;

      await this.prisma.jobRunLog.update({
        where: { id: job.id },
        data: { finishedAt: new Date(), status: JobStatus.SUCCESS },
      });
      if (summary.reviewsSeen || summary.processed || summary.posted || summary.savedToHubSpot) {
        this.logger.log(
          `Sync ${brand.name}: ${summary.reviewsSeen} seen, ${summary.created} new, ${summary.updated} edited, ` +
            `${summary.processed} drafted, ${summary.posted} posted, ${summary.savedToHubSpot} saved to HubSpot.`,
        );
      }
      return summary;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.jobRunLog.update({
        where: { id: job.id },
        data: { finishedAt: new Date(), status: JobStatus.FAILED, error: message },
      });
      throw error;
    } finally {
      this.running.delete(brand.id);
    }
  }

  private async saveToHubSpot(brand: Brand): Promise<number> {
    if (!brand.crmSyncEnabled) return 0;
    const installed = await this.prisma.hubSpotInstallation.count({
      where: { brandId: brand.id, status: HubSpotInstallStatus.INSTALLED },
    });
    if (!installed) return 0;
    try {
      return (await this.crm.syncBrand(brand)).synced;
    } catch (error) {
      // HubSpot trouble must not fail the Google side of the sync; the dirty
      // reviews are retried next run.
      if (!(error instanceof HubSpotNotInstalledError)) {
        this.logger.error(`HubSpot save failed for ${brand.id}: ${error instanceof Error ? error.message : error}`);
      }
      return 0;
    }
  }
}

function emptySummary(): SyncSummary {
  return {
    businessesSynced: 0,
    accountsSynced: 0,
    reviewsSeen: 0,
    created: 0,
    updated: 0,
    removed: 0,
    repliedOnGoogle: 0,
    processed: 0,
    failed: 0,
    posted: 0,
    savedToHubSpot: 0,
  };
}

/** "accounts/{a}/locations/{l}" -> { accountName: "accounts/{a}", locationName: "locations/{l}" }. */
export function splitResource(resource: string): { accountName: string; locationName: string } {
  const match = resource.match(/^(accounts\/[^/]+)\/(locations\/[^/]+)$/);
  if (!match) {
    throw new Error(`Malformed platform location resource: ${resource}`);
  }
  return { accountName: match[1], locationName: match[2] };
}
