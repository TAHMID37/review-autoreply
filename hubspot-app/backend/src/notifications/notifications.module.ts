import { Module } from "@nestjs/common";
import { EmailNotifierService } from "./email-notifier.service";
import { NotificationsService } from "./notifications.service";
import { SlackNotifierService } from "./slack-notifier.service";

@Module({
  providers: [NotificationsService, SlackNotifierService, EmailNotifierService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
