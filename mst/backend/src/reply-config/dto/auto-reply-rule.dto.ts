import { CommentCondition } from "@prisma/client";
import { ArrayNotEmpty, IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateAutoReplyRuleDto {
  @IsString()
  @IsNotEmpty()
  brandId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(5, { each: true })
  ratings!: number[];

  @IsEnum(CommentCondition)
  comment!: CommentCondition;

  @IsInt()
  @Min(0)
  delayHours!: number;

  @IsArray()
  @IsString({ each: true })
  templateIds!: string[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  rank?: number;
}

export class UpdateAutoReplyRuleDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(5, { each: true })
  ratings?: number[];

  @IsOptional()
  @IsEnum(CommentCondition)
  comment?: CommentCondition;

  @IsOptional()
  @IsInt()
  @Min(0)
  delayHours?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  templateIds?: string[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  rank?: number;
}
