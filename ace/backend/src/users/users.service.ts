import { Injectable } from "@nestjs/common";
import { AuthUserDto } from "../auth/dto/auth-user.dto";
import { PrismaService } from "../common/prisma/prisma.service";

/** Fields ever safe to send to the browser. Deliberately an allowlist (not a
 *  blocklist on the full model) so a new sensitive column added later is
 *  excluded by default instead of leaking until someone remembers to hide it. */
const SAFE_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** For dashboard-facing use: never includes passwordHash. */
  findSafeById(id: string): Promise<AuthUserDto | null> {
    return this.prisma.user.findUnique({ where: { id }, select: SAFE_USER_SELECT });
  }

  /** For AuthService only — includes passwordHash to verify a login attempt. */
  findForAuthByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /** For AuthService only — includes passwordHash, to re-check the current
   *  password before letting someone change their own login details. */
  findForAuthById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /** True when the email is already taken by a *different* user. */
  async isEmailTakenByAnother(email: string, userId: string): Promise<boolean> {
    const owner = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    return owner !== null && owner.id !== userId;
  }

  updateAccount(
    id: string,
    data: { name?: string; email?: string; passwordHash?: string },
  ): Promise<AuthUserDto> {
    return this.prisma.user.update({ where: { id }, data, select: SAFE_USER_SELECT });
  }
}
