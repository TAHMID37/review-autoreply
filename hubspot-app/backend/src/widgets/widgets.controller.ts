import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthUserDto } from "../auth/dto/auth-user.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { EMBED_SCRIPT } from "./embed-script";
import { CreateWidgetDto, UpdateWidgetDto } from "./widget.dto";
import { WidgetsService } from "./widgets.service";

@Controller("widgets")
@UseGuards(JwtAuthGuard)
export class WidgetsController {
  constructor(private readonly widgets: WidgetsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUserDto) {
    const widgets = await this.widgets.list(user.brandId);
    return widgets.map((w) => ({ ...w, snippet: this.widgets.snippet(w) }));
  }

  @Post()
  async create(@CurrentUser() user: AuthUserDto, @Body() dto: CreateWidgetDto) {
    const w = await this.widgets.create(user.brandId, dto);
    return { ...w, snippet: this.widgets.snippet(w) };
  }

  @Patch(":id")
  async update(@CurrentUser() user: AuthUserDto, @Param("id") id: string, @Body() dto: UpdateWidgetDto) {
    const w = await this.widgets.update(user.brandId, id, dto);
    return { ...w, snippet: this.widgets.snippet(w) };
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUserDto, @Param("id") id: string) {
    return this.widgets.remove(user.brandId, id);
  }
}

/** Public, unauthenticated: what visitors' browsers load on a business's website. */
@Controller()
export class PublicWidgetController {
  constructor(private readonly widgets: WidgetsService) {}

  @Get("public/widgets/:publicId/feed")
  async feed(@Param("publicId") publicId: string, @Headers("origin") origin: string | undefined, @Res({ passthrough: true }) res: Response) {
    const feed = await this.widgets.feed(publicId, origin);
    // The dashboard's live preview must show edits straight away.
    res.setHeader("Cache-Control", this.widgets.isPreviewOrigin(origin) ? "no-store" : "public, max-age=300");
    res.setHeader("Vary", "Origin");
    return feed;
  }

  @Get("widget/embed.js")
  script(@Res() res: Response) {
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(EMBED_SCRIPT);
  }
}
