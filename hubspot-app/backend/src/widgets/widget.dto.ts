import { WidgetLayout } from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

const HEX = /^#[0-9a-fA-F]{6}$/;

export class WidgetThemeDto {
  @IsOptional() @Matches(HEX, { message: "accent must be a #RRGGBB colour" }) accent?: string;
  @IsOptional() @Matches(HEX, { message: "background must be a #RRGGBB colour" }) background?: string;
  @IsOptional() @Matches(HEX, { message: "text must be a #RRGGBB colour" }) text?: string;
  @IsOptional() @IsInt() @Min(0) @Max(32) radius?: number;
}

export class CreateWidgetDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsEnum(WidgetLayout) layout?: WidgetLayout;
  @IsOptional() @IsArray() @IsString({ each: true }) locationIds?: string[];
  @IsOptional() @IsInt() @Min(1) @Max(5) minRating?: number;
  @IsOptional() @IsInt() @Min(1) @Max(50) maxReviews?: number;
  @IsOptional() @IsBoolean() requireComment?: boolean;
  @IsOptional() @ValidateNested() @Type(() => WidgetThemeDto) theme?: WidgetThemeDto;
  /** e.g. "example.com" (also allows www.example.com) or "*.example.com". */
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) allowedDomains?: string[];
  @IsOptional() @IsBoolean() enabled?: boolean;
}

export class UpdateWidgetDto {
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @IsOptional() @IsEnum(WidgetLayout) layout?: WidgetLayout;
  @IsOptional() @IsArray() @IsString({ each: true }) locationIds?: string[];
  @IsOptional() @IsInt() @Min(1) @Max(5) minRating?: number;
  @IsOptional() @IsInt() @Min(1) @Max(50) maxReviews?: number;
  @IsOptional() @IsBoolean() requireComment?: boolean;
  @IsOptional() @ValidateNested() @Type(() => WidgetThemeDto) theme?: WidgetThemeDto;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) allowedDomains?: string[];
  @IsOptional() @IsBoolean() enabled?: boolean;
}
