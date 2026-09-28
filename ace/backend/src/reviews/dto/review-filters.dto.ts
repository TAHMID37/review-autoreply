import { Transform } from "class-transformer";
import { IsBoolean, IsEnum, IsOptional, IsString } from "class-validator";
import { ReplyStatus } from "@prisma/client";

/** Query params for the review inbox. All optional - omitted means "no filter". */
export class ReviewFiltersDto {
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
}
