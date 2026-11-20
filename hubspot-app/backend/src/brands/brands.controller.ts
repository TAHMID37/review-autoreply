import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthUserDto } from "../auth/dto/auth-user.dto";
import { AdminGuard } from "../auth/guards/admin.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { BrandsService } from "./brands.service";
import { AutoReplySettingDto, UpdateBrandDto } from "./dto/update-brand.dto";

@Controller("brands")
@UseGuards(JwtAuthGuard)
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUserDto) {
    return this.brandsService.findAll(user.brandId);
  }

  @Get("me/setup")
  setup(@CurrentUser() user: AuthUserDto) {
    return this.brandsService.getSetup(user.brandId);
  }

  @Post("me/retry-properties")
  @UseGuards(AdminGuard)
  retryProperties(@CurrentUser() user: AuthUserDto) {
    return this.brandsService.retryProperties(user.brandId);
  }

  @Get(":id")
  findById(@CurrentUser() user: AuthUserDto, @Param("id") id: string) {
    return this.brandsService.findById(user.brandId, id);
  }

  /** Admins only: alert emails and the business name affect everyone. */
  @Patch(":id")
  @UseGuards(AdminGuard)
  update(@CurrentUser() user: AuthUserDto, @Param("id") id: string, @Body() dto: UpdateBrandDto) {
    return this.brandsService.update(user.brandId, id, dto);
  }

  /** Auto-reply on/off with consent. Admins only - it posts publicly as the business. */
  @Put("me/auto-reply")
  @UseGuards(AdminGuard)
  setAutoReply(@CurrentUser() user: AuthUserDto, @Body() dto: AutoReplySettingDto) {
    return this.brandsService.setAutoReply(user.brandId, user.id, dto);
  }
}
