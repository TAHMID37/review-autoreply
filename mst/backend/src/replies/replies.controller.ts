import { Body, Controller, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthUserDto } from "../auth/dto/auth-user.dto";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UpdateReplyDto } from "./dto/update-reply.dto";
import { RepliesService } from "./replies.service";

@Controller("replies")
@UseGuards(JwtAuthGuard)
export class RepliesController {
  constructor(private readonly replies: RepliesService) {}

  @Patch(":id")
  edit(@Param("id") id: string, @Body() dto: UpdateReplyDto) {
    return this.replies.edit(id, dto.finalReply);
  }

  @Post(":id/approve")
  approve(@Param("id") id: string, @CurrentUser() user: AuthUserDto) {
    return this.replies.approve(id, user.id);
  }

  @Post(":id/reject")
  reject(@Param("id") id: string, @CurrentUser() user: AuthUserDto) {
    return this.replies.reject(id, user.id);
  }
}
