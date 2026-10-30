import { UserRole } from "@prisma/client";

/** The signed-in user as every guarded route sees it. `brandId` is the
 *  business they are acting for - every query is scoped by it. */
export interface AuthUserDto {
  id: string;
  brandId: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface LoginResponseDto {
  accessToken: string;
  user: AuthUserDto;
}
