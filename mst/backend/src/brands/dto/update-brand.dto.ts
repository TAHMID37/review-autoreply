import { IsArray, IsOptional, IsString } from "class-validator";

/** Everything editable from Settings → brand tone/rules editor. */
export class UpdateBrandDto {
  @IsOptional()
  @IsString()
  tone?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  forbiddenWords?: string[];
}
