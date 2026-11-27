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
   */
  async notifyNeedsApproval(review: ReviewWithDetail, reason: string): Promise<void> {
    const message = this.buildMessage(review, reason);
    const recipients = this.env.ALERT_EMAIL_TO?.trim() ?? "";

    await Promise.all([
      this.dispatch(NotificationChannel.SLACK, review.id, () => this.slack.send(message), this.slack.isEnabled),
      this.dispatch(
        NotificationChannel.EMAIL,
        review.id,
        () => this.email.send(recipients, `Review needs approval — ${review.location.brand.name}`, message),
        this.email.isEnabled && recipients.length > 0,
      ),
    ]);
  }

  /**
   * Emails the alert address about a low-star review that was NOT held (a
   * 1-2 star review with no comment is auto-replied). Held reviews already
   * send their own alert through notifyNeedsApproval, so nobody gets two.
   */
  async notifyNegativeReview(review: ReviewWithDetail): Promise<void> {
    const recipients = this.env.ALERT_EMAIL_TO?.trim() ?? "";
    const message = [
      `New ${review.rating}-star review`,
      `${review.location.brand.name} — ${review.location.name}`,
      `From: ${review.reviewerName}`,
      "",
      `"${review.reviewText || "(no written comment)"}"`,
      "",
      "An automatic reply is queued and will be posted after its delay. You can edit or stop it in the dashboard:",
      this.env.WEB_APP_URL,
    ].join("\n");

    await this.dispatch(
      NotificationChannel.EMAIL,
      review.id,
      () => this.email.send(recipients, `Negative review (${review.rating}★) — ${review.location.brand.name}`, message),
      this.email.isEnabled && recipients.length > 0,
    );
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
      this.env.WEB_APP_URL,
    ].join("\n");
  }
}
