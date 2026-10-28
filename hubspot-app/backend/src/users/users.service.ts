import { Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AuthUserDto } from "../auth/dto/auth-user.dto";
import { PrismaService } from "../common/prisma/prisma.service";

/** Fields ever safe to send to the browser. Deliberately an allowlist so a new
 *  sensitive column added later is excluded by default. */
const SAFE_USER_SELECT = {
  id: true,
  brandId: true,
  email: true,
  name: true,
  role: true,
} as const;

export interface HubSpotUserIdentity {
  hubspotUserId: string | null;
  email: string;
  name?: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findSafeById(id: string): Promise<AuthUserDto | null> {
    return this.prisma.user.findUnique({ where: { id }, select: SAFE_USER_SELECT });
  }

  listForBrand(brandId: string): Promise<AuthUserDto[]> {
    return this.prisma.user.findMany({ where: { brandId }, select: SAFE_USER_SELECT, orderBy: { email: "asc" } });
  }

  /**
   * Finds or creates the user for a HubSpot sign-in to one business.
   *
   * The first person into a business becomes its ADMIN (they installed the
   * app); everyone after that joins as STAFF until an admin promotes them.
   * Matching is by HubSpot user id first, then email, so a user whose email
   * changed in HubSpot keeps the same account.
   */
  async upsertFromHubSpot(brandId: string, identity: HubSpotUserIdentity): Promise<AuthUserDto> {
    const email = identity.email.trim().toLowerCase();
    const name = identity.name?.trim() || email.split("@")[0];

    const existing =
      (identity.hubspotUserId
        ? await this.prisma.user.findUnique({
            where: { brandId_hubspotUserId: { brandId, hubspotUserId: identity.hubspotUserId } },
          })
        : null) ?? (await this.prisma.user.findUnique({ where: { brandId_email: { brandId, email } } }));

    if (existing) {
      return this.prisma.user.update({
        where: { id: existing.id },
        data: { email, hubspotUserId: identity.hubspotUserId ?? existing.hubspotUserId, lastLoginAt: new Date() },
        select: SAFE_USER_SELECT,
      });
    }

    const isFirst = (await this.prisma.user.count({ where: { brandId } })) === 0;
    return this.prisma.user.create({
      data: {
        brandId,
        email,
        name,
        hubspotUserId: identity.hubspotUserId,
        role: isFirst ? UserRole.ADMIN : UserRole.STAFF,
        lastLoginAt: new Date(),
      },
      select: SAFE_USER_SELECT,
    });
  }

  setRole(brandId: string, userId: string, role: UserRole) {
    return this.prisma.user.updateMany({ where: { id: userId, brandId }, data: { role } });
  }
}
