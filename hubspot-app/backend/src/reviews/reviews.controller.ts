import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthUserDto } from "../auth/dto/auth-user.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ReviewFiltersDto } from "./dto/review-filters.dto";
import { ReviewProcessorService } from "./review-processor.service";
import { ReviewsService } from "./reviews.service";

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

  @Get(":id")
  findById(@CurrentUser() user: AuthUserDto, @Param("id") id: string) {
    return this.reviews.findById(user.brandId, id);
  }

  /** Drafts replies for this business's reviews still awaiting one. Normally
   *  driven by the scheduler; exposed so staff can trigger it on demand. */
  @Post("process")
  process(@CurrentUser() user: AuthUserDto) {
    return this.processor.processPending(user.brandId);
  }
}
