import { UserRole } from "@prisma/client";

/** Shape of the data encoded inside the session JWT. */
export interface JwtPayload {
  sub: string;
  brandId: string;
  email: string;
  role: UserRole;
}
