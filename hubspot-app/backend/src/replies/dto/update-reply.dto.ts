import { IsString, MaxLength, MinLength } from "class-validator";

export class UpdateReplyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000) // Google rejects longer replies
  finalReply!: string;
}
