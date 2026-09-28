import { UserRole } from "@prisma/client";

/** Shape of the data encoded inside the JWT. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}
