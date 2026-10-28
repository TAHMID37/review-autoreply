import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthUserDto } from "../auth/dto/auth-user.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AutoReplyRulesService } from "./auto-reply-rules.service";
import { CreateAutoReplyRuleDto, UpdateAutoReplyRuleDto } from "./dto/auto-reply-rule.dto";

@Controller("auto-reply-rules")
@UseGuards(JwtAuthGuard)
export class AutoReplyRulesController {
  constructor(private readonly rules: AutoReplyRulesService) {}

  @Get()
  list(@CurrentUser() user: AuthUserDto) {
    return this.rules.list(user.brandId);
  }

  @Post()
  create(@CurrentUser() user: AuthUserDto, @Body() dto: CreateAutoReplyRuleDto) {
    return this.rules.create(user.brandId, dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUserDto, @Param("id") id: string, @Body() dto: UpdateAutoReplyRuleDto) {
    return this.rules.update(user.brandId, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUserDto, @Param("id") id: string) {
    return this.rules.remove(user.brandId, id);
  }
}
