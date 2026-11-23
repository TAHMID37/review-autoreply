import { Transform } from "class-transformer";
import { IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { ReplyStatus } from "@prisma/client";

/** Query params for the review inbox. All optional - omitted means "no filter". */
export class ReviewFiltersDto {
  /** Accepted for compatibility but ignored: the business comes from the session. */
  @IsOptional()
  @IsString()
  brandId?: string;

  @IsOptional()
  @IsString()
  locationId?: string;

  /** Filters by the status of the review's reply, which is what the
   *  dashboard tabs ("Needs approval", "Auto-replied") actually mean. */
  @IsOptional()
  @IsEnum(ReplyStatus)
  replyStatus?: ReplyStatus;

  /** Free-text search across reviewer name and review body. */
  @IsOptional()
  @IsString()
  search?: string;

  // Transform runs before validation, so the incoming "true"/"false" query
  // string is coerced to a real boolean first and then validated as one.
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  needsApproval?: boolean;

  /** Server-side paging, used by `GET /reviews/page`. */
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  /** The inbox tab. */
  @IsOptional()
  @IsIn(["all", "needsApproval", "autoReplied"])
  tab?: "all" | "needsApproval" | "autoReplied";

  /** Only reviews left on or after this moment. */
  @IsOptional()
  @IsDateString()
  since?: string;
}
