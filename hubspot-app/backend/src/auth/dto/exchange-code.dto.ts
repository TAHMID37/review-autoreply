import { IsString, MinLength } from "class-validator";

export class ExchangeCodeDto {
  @IsString()
  @MinLength(16)
  code!: string;
}
