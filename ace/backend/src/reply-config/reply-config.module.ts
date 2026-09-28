import { Module } from "@nestjs/common";
import { AutoReplyRulesController } from "./auto-reply-rules.controller";
import { AutoReplyRulesService } from "./auto-reply-rules.service";
import { ResponseTemplatesController } from "./response-templates.controller";
import { ResponseTemplatesService } from "./response-templates.service";

/**
 * The configurable auto-reply engine's management API: CRUD for response
 * templates and auto-reply rules, mirroring Birdeye's Settings screens.
 */
@Module({
  controllers: [ResponseTemplatesController, AutoReplyRulesController],
  providers: [ResponseTemplatesService, AutoReplyRulesService],
})
export class ReplyConfigModule {}
