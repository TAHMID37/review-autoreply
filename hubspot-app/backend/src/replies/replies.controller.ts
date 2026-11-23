import { Body, Controller, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString } from "class-validator";
import { AuthUserDto } from "../auth/dto/auth-user.dto";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UpdateReplyDto } from "./dto/update-reply.dto";
import { RepliesService } from "./replies.service";

class BulkDecisionDto {
  @IsIn(["approve", "reject"])
  action!: "approve" | "reject";

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  ids?: string[];

  /** Every reply waiting for approval, not just the listed ids. */
  @IsOptional()
  @IsBoolean()
  allPending?: boolean;
}

@Controller("replies")
@UseGuards(JwtAuthGuard)
export class RepliesController {
  constructor(private readonly replies: RepliesService) {}

  /** Approve or reject many drafts in one go. Declared before the `:id` routes. */
  @Post("bulk")
  bulk(@Body() dto: BulkDecisionDto, @CurrentUser() user: AuthUserDto) {
    return this.replies.bulkDecide(user.brandId, user.id, dto.action, { ids: dto.ids, allPending: dto.allPending });
  }

  @Patch(":id")
  edit(@Param("id") id: string, @Body() dto: UpdateReplyDto, @CurrentUser() user: AuthUserDto) {
    return this.replies.edit(user.brandId, id, dto.finalReply);
  }

  @Post(":id/approve")
  approve(@Param("id") id: string, @CurrentUser() user: AuthUserDto) {
    return this.replies.approve(user.brandId, id, user.id);
  }

  @Post(":id/reject")
  reject(@Param("id") id: string, @CurrentUser() user: AuthUserDto) {
    return this.replies.reject(user.brandId, id, user.id);
  }
}
