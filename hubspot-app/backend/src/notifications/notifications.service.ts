import { Inject, Injectable, Logger } from "@nestjs/common";
import { NotificationChannel } from "@prisma/client";
import { Env } from "../config/env.schema";
import { APP_ENV } from "../config/env.token";
import { PrismaService } from "../common/prisma/prisma.service";
import { ReviewWithDetail } from "../reviews/reviews.service";
import { EmailNotifierService } from "./email-notifier.service";
import { SlackNotifierService } from "./slack-notifier.service";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly slack: SlackNotifierService,
    private readonly email: EmailNotifierService,
    @Inject(APP_ENV) private readonly env: Env,
  ) {}

  /**
   * Alerts staff that a review needs a human. Every attempt is written to
   * notification_logs — so "was anyone actually told about this?" is
   * answerable from the database instead of from someone's inbox.
   *
   * A failing channel is logged and swallowed: a Slack outage must not stop
   * the review from being safely held for approval.
   *
   * Each business sets its own alert emails and Slack webhook in Settings.
   * ALERT_EMAIL_TO is only a fallback for a business that has set none.
   */
  async notifyNeedsApproval(review: ReviewWithDetail, reason: string): Promise<void> {
    const brand = review.location.brand;
    const message = this.buildMessage(review, reason);
    const recipients = (brand.alertEmails.length ? brand.alertEmails.join(",") : this.env.ALERT_EMAIL_TO?.trim()) ?? "";
    const slackUrl = brand.slackWebhookUrl;

    await Promise.all([
      this.dispatch(NotificationChannel.SLACK, review.id, () => this.slack.send(slackUrl!, message), Boolean(slackUrl)),
      this.dispatch(
        NotificationChannel.EMAIL,
        review.id,
        () => this.email.send(recipients, `Review needs approval — ${brand.name}`, message),
        this.email.isEnabled && recipients.length > 0,
      ),
    ]);
  }

  private async dispatch(
    channel: NotificationChannel,
    reviewId: string,
    send: () => Promise<void>,
    isEnabled: boolean,
  ): Promise<void> {
    if (!isEnabled) {
      return;
    }

    try {
      await send();
      await this.prisma.notificationLog.create({
        data: { reviewId, channel, status: "sent" },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`${channel} notification failed for review ${reviewId}: ${message}`);
      await this.prisma.notificationLog.create({
        data: { reviewId, channel, status: "failed", error: message },
      });
    }
  }

  private buildMessage(review: ReviewWithDetail, reason: string): string {
    return [
      `New ${review.rating}-star review needs approval`,
      `${review.location.brand.name} — ${review.location.name}`,
      `From: ${review.reviewerName}`,
      "",
      `"${review.reviewText || "(no written comment)"}"`,
      "",
      `Why it was held: ${reason}`,
      "",
      "Approve or edit the drafted reply in the dashboard:",
      `${this.env.WEB_APP_URL.replace(/\/$/, "")}/alerts`,
    ].join("\n");
  }
}
