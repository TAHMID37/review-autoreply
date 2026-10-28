import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

/**
 * Changing your own login details from the Settings screen.
 *
 * `currentPassword` is always required: it stops anyone who finds an unlocked
 * browser from silently taking over the account. Every other field is optional
 * so the form can change just the email, just the password, or both.
 */
export class UpdateAccountDto {
  @IsString()
  @MinLength(1, { message: "Enter your current password to save changes" })
  currentPassword!: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: "Name cannot be empty" })
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: "Enter a valid email address" })
  email?: string;

  /** Must satisfy the same minimum the login form enforces, otherwise the new
   *  password would be rejected at the next sign-in. */
  @IsOptional()
  @IsString()
  @MinLength(8, { message: "New password must be at least 8 characters" })
  newPassword?: string;
}
