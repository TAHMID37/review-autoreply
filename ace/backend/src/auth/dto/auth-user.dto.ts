import { UserRole } from "@prisma/client";

/** The subset of a User that is ever safe to send to the browser — never passwordHash. */
export interface AuthUserDto {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface LoginResponseDto {
  accessToken: string;
  user: AuthUserDto;
}
