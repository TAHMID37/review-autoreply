import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthUserDto } from "../auth/dto/auth-user.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CreateResponseTemplateDto, UpdateResponseTemplateDto } from "./dto/response-template.dto";
import { ResponseTemplatesService } from "./response-templates.service";

@Controller("response-templates")
@UseGuards(JwtAuthGuard)
export class ResponseTemplatesController {
  constructor(private readonly templates: ResponseTemplatesService) {}

  @Get()
  list(@CurrentUser() user: AuthUserDto) {
    return this.templates.list(user.brandId);
  }

  @Post()
  create(@CurrentUser() user: AuthUserDto, @Body() dto: CreateResponseTemplateDto) {
    return this.templates.create(user.brandId, dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUserDto, @Param("id") id: string, @Body() dto: UpdateResponseTemplateDto) {
    return this.templates.update(user.brandId, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUserDto, @Param("id") id: string) {
    return this.templates.remove(user.brandId, id);
  }
}
