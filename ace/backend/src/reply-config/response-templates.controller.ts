import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CreateResponseTemplateDto, UpdateResponseTemplateDto } from "./dto/response-template.dto";
import { ResponseTemplatesService } from "./response-templates.service";

@Controller("response-templates")
@UseGuards(JwtAuthGuard)
export class ResponseTemplatesController {
  constructor(private readonly templates: ResponseTemplatesService) {}

  @Get()
  list(@Query("brandId") brandId?: string) {
    return this.templates.list(brandId);
  }

  @Post()
  create(@Body() dto: CreateResponseTemplateDto) {
    return this.templates.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateResponseTemplateDto) {
    return this.templates.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.templates.remove(id);
  }
}
