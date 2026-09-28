import { Module } from "@nestjs/common";
import { AutoReplyService } from "./auto-reply.service";
import { RepliesController } from "./replies.controller";
import { RepliesService } from "./replies.service";

@Module({
  controllers: [RepliesController],
  providers: [RepliesService, AutoReplyService],
  exports: [RepliesService, AutoReplyService],
})
export class RepliesModule {}
