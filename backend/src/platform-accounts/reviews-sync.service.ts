import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { JobStatus, Platform } from "@prisma/client";
import { Env } from "../config/env.schema";
import { APP_ENV } from "../config/env.token";
import { PrismaService } from "../common/prisma/prisma.service";
import { ReviewProcessorService } from "../reviews/review-processor.service";
import { ReviewsService } from "../reviews/reviews.service";
import { GoogleReviewsClient } from "./google-reviews.client";
import { PlatformAccountsService } from "./platform-accounts.service";
import { ReviewPosterService } from "./review-poster.service";

export interface SyncSummary {
  accountsSynced: number;
  reviewsSeen: number;
  created: number;
  updated: number;
  processed: number;
  failed: number;
}

/**
 * Read-only ingestion. On a timer (and on demand) it pulls reviews from every
 * connected Google account and stores new or edited ones, then runs the drafting
 * pipeline. It never posts to Google - the client it uses has no write methods.
 */
@Injectable()
export class ReviewsSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReviewsSyncService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: PlatformAccountsService,
    private readonly google: GoogleReviewsClient,
    private readonly reviews: ReviewsService,
    private readonly processor: ReviewProcessorService,
    private readonly poster: ReviewPosterService,
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
    // Do not keep the process alive just for the timer.
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Pulls and stores reviews from all connected accounts, then drafts replies. */
  async syncAll(): Promise<SyncSummary> {
    if (this.running) {
      this.logger.warn("Sync already in progress - skipping this run.");
      return { accountsSynced: 0, reviewsSeen: 0, created: 0, updated: 0, processed: 0, failed: 0 };
    }
    this.running = true;

    const job = await this.prisma.jobRunLog.create({ data: { jobName: "google-review-sync" } });
    const summary: SyncSummary = { accountsSynced: 0, reviewsSeen: 0, created: 0, updated: 0, processed: 0, failed: 0 };

    try {
      const connected = await this.accounts.listConnected();
      for (const account of connected) {
        const token = await this.accounts.getValidAccessToken(account);
        const links = await this.prisma.platformLocation.findMany({ where: { platformAccountId: account.id } });

        for (const link of links) {
          const { accountName, locationName } = splitResource(link.externalLocationId);
          const reviews = await this.google.listReviews(token, accountName, locationName);
          for (const r of reviews) {
            summary.reviewsSeen++;
            const outcome = await this.reviews.upsertFromPlatform({
              platform: Platform.GOOGLE,
              locationId: link.locationId,
              externalReviewId: r.externalReviewId,
              reviewerName: r.reviewerName,
              rating: r.rating,
              reviewText: r.reviewText,
              reviewedAt: r.reviewedAt,
            });
            if (outcome.outcome === "created") summary.created++;
            else if (outcome.outcome === "updated") summary.updated++;
          }
        }
        summary.accountsSynced++;
      }

      // Draft replies for everything newly ingested or edited.
      const result = await this.processor.processPending();
      summary.processed = result.processed;
      summary.failed = result.failed;

      // Post anything now due (auto-postable drafts past their delay, and manual
      // approvals). No-op unless AUTO_POST_ENABLED, so this stays draft-only
      // until go-live.
      const postResult = await this.poster.postDue();
      if (postResult.posted || postResult.failed) {
        this.logger.log(`Auto-post: ${postResult.posted} posted, ${postResult.failed} failed.`);
      }

      await this.prisma.jobRunLog.update({
        where: { id: job.id },
        data: { finishedAt: new Date(), status: JobStatus.SUCCESS },
      });
      this.logger.log(
        `Sync done: ${summary.accountsSynced} account(s), ${summary.reviewsSeen} seen, ` +
          `${summary.created} new, ${summary.updated} edited, ${summary.processed} drafted.`,
      );
      return summary;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.jobRunLog.update({
        where: { id: job.id },
        data: { finishedAt: new Date(), status: JobStatus.FAILED, error: message },
      });
      this.logger.error(`Sync failed: ${message}`);
      throw error;
    } finally {
      this.running = false;
    }
  }
}

/** "accounts/{a}/locations/{l}" -> { accountName: "accounts/{a}", locationName: "locations/{l}" }. */
export function splitResource(resource: string): { accountName: string; locationName: string } {
  const match = resource.match(/^(accounts\/[^/]+)\/(locations\/[^/]+)$/);
  if (!match) {
    throw new Error(`Malformed platform location resource: ${resource}`);
  }
  return { accountName: match[1], locationName: match[2] };
}
