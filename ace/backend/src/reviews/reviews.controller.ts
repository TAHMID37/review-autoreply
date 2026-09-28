import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
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
  findAll(@Query() filters: ReviewFiltersDto) {
    return this.reviews.findAll(filters);
  }

  @Get(":id")
  findById(@Param("id") id: string) {
    return this.reviews.findById(id);
  }

  /** Runs the AI pipeline over every review still awaiting a reply. Normally
   *  driven by the scheduler; exposed so staff can trigger it on demand. */
  @Post("process")
  process() {
    return this.processor.processPending();
  }
}
