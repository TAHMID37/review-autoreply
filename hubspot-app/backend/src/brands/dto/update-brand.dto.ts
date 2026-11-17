import { NewContactPolicy, ReportFrequency } from "@prisma/client";
import { ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";

/** Everything editable from Settings for the signed-in business. */
export class UpdateBrandDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

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

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsEmail({}, { each: true, message: "Each alert email must be a valid email address" })
  alertEmails?: string[];

  @IsOptional()
  @IsBoolean()
  crmSyncEnabled?: boolean;

  @IsOptional()
  @IsEnum(NewContactPolicy)
  newContactPolicy?: NewContactPolicy;

  /** Emailed review report to the alert emails. NONE turns it off. */
  @IsOptional()
  @IsEnum(ReportFrequency)
  reportFrequency?: ReportFrequency;
}

/**
 * Switching auto-replies on requires ticking the consent box: Google requires
 * the business's consent for replies posted on its behalf.
 */
export class AutoReplySettingDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsBoolean()
  consent?: boolean;
}
