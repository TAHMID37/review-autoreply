import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AutoReplyRulesService } from "./auto-reply-rules.service";
import { CreateAutoReplyRuleDto, UpdateAutoReplyRuleDto } from "./dto/auto-reply-rule.dto";

@Controller("auto-reply-rules")
@UseGuards(JwtAuthGuard)
export class AutoReplyRulesController {
  constructor(private readonly rules: AutoReplyRulesService) {}

  @Get()
  list(@Query("brandId") brandId?: string) {
    return this.rules.list(brandId);
  }

  @Post()
  create(@Body() dto: CreateAutoReplyRuleDto) {
    return this.rules.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateAutoReplyRuleDto) {
    return this.rules.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.rules.remove(id);
  }
}
