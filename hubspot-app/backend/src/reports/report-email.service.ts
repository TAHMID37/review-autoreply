import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Brand, BrandStatus } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { Env } from "../config/env.schema";
import { APP_ENV } from "../config/env.token";
import { EmailNotifierService } from "../notifications/email-notifier.service";
import { bucketsToCsv, ReportBucket } from "./report-periods";
import { isReportDue, periodOf, ScheduledFrequency } from "./report-schedule";
import { ReportsService } from "./reports.service";

const CHECK_EVERY_MS = 60 * 60 * 1000;

/** Emails each business its weekly or monthly review report, if it asked for one. */
@Injectable()
export class ReportEmailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReportEmailService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    private readonly email: EmailNotifierService,
    @Inject(APP_ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    if (!this.env.REVIEW_SYNC_ENABLED) return;
    this.timer = setInterval(() => {
      this.sendDueReports().catch((e) => this.logger.error(`Scheduled reports failed: ${e instanceof Error ? e.message : e}`));
    }, CHECK_EVERY_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async sendDueReports(now = new Date()): Promise<number> {
    if (!this.email.isEnabled) return 0;
    const brands = await this.prisma.brand.findMany({
      where: { status: BrandStatus.ACTIVE, reportFrequency: { not: "NONE" }, alertEmails: { isEmpty: false } },
    });
    let sent = 0;
    for (const brand of brands) {
      const frequency = brand.reportFrequency as ScheduledFrequency;
      if (!isReportDue(frequency, brand.reportLastSentAt, now)) continue;
      try {
        await this.sendReport(brand, frequency, now);
        // Marked only after a successful send, so a failed one is retried next hour.
        await this.prisma.brand.update({ where: { id: brand.id }, data: { reportLastSentAt: now } });
        sent++;
      } catch (error) {
        this.logger.warn(`Report email for ${brand.name} failed: ${error instanceof Error ? error.message : error}`);
      }
    }
    return sent;
  }

  private async sendReport(brand: Brand, frequency: ScheduledFrequency, now: Date): Promise<void> {
    const period = periodOf(frequency);
    const { buckets } = await this.reports.getPeriodReport(brand.id, period, undefined, now);
    // The last bucket is the period that just started; the one before is the one that just finished.
    const finished = buckets.at(-2)!;
    const before = buckets.at(-3);
    await this.email.send(
      brand.alertEmails.join(","),
      `Your ${frequency === "WEEKLY" ? "weekly" : "monthly"} Google review report: ${brand.name}`,
      buildReportBody(brand.name, frequency, finished, before, `${this.env.WEB_APP_URL.replace(/\/$/, "")}/reports`),
      [{ filename: "review-report.csv", content: bucketsToCsv(buckets), contentType: "text/csv" }],
    );
  }
}

export function buildReportBody(
  businessName: string,
  frequency: ScheduledFrequency,
  finished: ReportBucket,
  before: ReportBucket | undefined,
  reportsUrl: string,
): string {
  const where = frequency === "WEEKLY" ? `the week starting ${finished.label}` : finished.label;
  const lines = [`Google reviews for ${businessName}, ${where}`, ""];
  if (finished.total === 0) {
    lines.push("No new reviews this period.");
  } else {
    lines.push(
      `New reviews: ${finished.total}${before ? ` (${before.total} the period before)` : ""}`,
      `Average rating: ${finished.averageRating} stars${before?.averageRating != null ? ` (${before.averageRating} before)` : ""}`,
      `5 stars: ${finished.ratingMix[4]}, 4 stars: ${finished.ratingMix[3]}, 3 stars: ${finished.ratingMix[2]}, 2 stars: ${finished.ratingMix[1]}, 1 star: ${finished.ratingMix[0]}`,
      `Replied: ${finished.replied} of ${finished.total}${finished.responseRate !== null ? ` (response rate ${finished.responseRate}%)` : ""}`,
    );
  }
  lines.push("", `The full report, with the last periods side by side, is attached as a CSV. See it online: ${reportsUrl}`);
  return lines.join("\n");
}
