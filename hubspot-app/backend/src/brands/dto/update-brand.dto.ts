import { NewContactPolicy } from "@prisma/client";
import { ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl, ValidateIf } from "class-validator";

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

  /** Empty string clears it. */
  @IsOptional()
  @ValidateIf((_, v) => v !== "")
  @IsUrl({ protocols: ["https"], require_protocol: true }, { message: "Slack webhook must be an https:// URL" })
  slackWebhookUrl?: string;

  @IsOptional()
  @IsBoolean()
  crmSyncEnabled?: boolean;

  @IsOptional()
  @IsEnum(NewContactPolicy)
  newContactPolicy?: NewContactPolicy;
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
