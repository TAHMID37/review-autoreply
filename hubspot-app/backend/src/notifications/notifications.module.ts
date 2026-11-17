import { Module } from "@nestjs/common";
import { EmailNotifierService } from "./email-notifier.service";
import { NotificationsService } from "./notifications.service";

@Module({
  providers: [NotificationsService, EmailNotifierService],
  exports: [NotificationsService, EmailNotifierService],
})
export class NotificationsModule {}
