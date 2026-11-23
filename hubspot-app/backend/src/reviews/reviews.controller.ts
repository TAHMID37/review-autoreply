import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthUserDto } from "../auth/dto/auth-user.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { IsBoolean } from "class-validator";
import { ReviewFiltersDto } from "./dto/review-filters.dto";
import { ReviewProcessorService } from "./review-processor.service";
import { ReviewsService } from "./reviews.service";

class WidgetVisibilityDto {
  @IsBoolean()
  hidden!: boolean;
}

@Controller("reviews")
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly processor: ReviewProcessorService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: AuthUserDto, @Query() filters: ReviewFiltersDto) {
    return this.reviews.findAll(user.brandId, filters);
  }

  /** A server-side page of reviews plus tab counts, for the Reviews screen. */
  @Get("page")
  findPage(@CurrentUser() user: AuthUserDto, @Query() filters: ReviewFiltersDto) {
    return this.reviews.findPage(user.brandId, filters);
  }

  @Get(":id")
  findById(@CurrentUser() user: AuthUserDto, @Param("id") id: string) {
    return this.reviews.findById(user.brandId, id);
  }

  /** Hide a review from (or show it again in) the website widgets. */
  @Patch(":id/widget-visibility")
  setWidgetVisibility(@CurrentUser() user: AuthUserDto, @Param("id") id: string, @Body() dto: WidgetVisibilityDto) {
    return this.reviews.setWidgetVisibility(user.brandId, id, dto.hidden);
  }

  /** Drafts replies for this business's reviews still awaiting one. Normally
   *  driven by the scheduler; exposed so staff can trigger it on demand. */
  @Post("process")
  process(@CurrentUser() user: AuthUserDto) {
    return this.processor.processPending(user.brandId);
  }
}
