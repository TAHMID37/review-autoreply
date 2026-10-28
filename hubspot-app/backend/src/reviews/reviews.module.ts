import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { RepliesModule } from "../replies/replies.module";
import { SafetyModule } from "../safety/safety.module";
import { ReviewProcessorService } from "./review-processor.service";
import { ReviewsController } from "./reviews.controller";
import { ReviewsService } from "./reviews.service";

@Module({
  imports: [SafetyModule, NotificationsModule, RepliesModule],
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewProcessorService],
  exports: [ReviewsService, ReviewProcessorService],
})
export class ReviewsModule {}
