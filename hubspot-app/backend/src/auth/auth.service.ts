import { ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { BrandStatus } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../common/prisma/prisma.service";
import { Env } from "../config/env.schema";
import { APP_ENV } from "../config/env.token";
import { UsersService } from "../users/users.service";
import { AuthUserDto, LoginResponseDto } from "./dto/auth-user.dto";
import { JwtPayload } from "./dto/jwt-payload.type";

/** A login code is single-use and only needs to survive one browser redirect. */
const LOGIN_CODE_TTL_MS = 2 * 60 * 1000;

export const DEV_PORTAL_ID = "dev-portal";

/**
 * Sessions for the dashboard. There are no passwords in this app: people sign
 * in with HubSpot (see HubSpotInstallService), which hands us a verified user
 * for a specific business. We then issue a short-lived one-time code, and the
 * dashboard swaps that code for a session JWT here - so the JWT never appears
 * in a URL, browser history or server log.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @Inject(APP_ENV) private readonly env: Env,
  ) {}

  issueSession(user: AuthUserDto): LoginResponseDto {
    const payload: JwtPayload = { sub: user.id, brandId: user.brandId, email: user.email, role: user.role };
    return { accessToken: this.jwtService.sign(payload), user };
  }

  async createLoginCode(userId: string): Promise<string> {
    const code = randomBytes(32).toString("base64url");
    await this.prisma.loginCode.create({
      data: { code, userId, expiresAt: new Date(Date.now() + LOGIN_CODE_TTL_MS) },
    });
    return code;
  }

  async exchangeLoginCode(code: string): Promise<LoginResponseDto> {
    // Mark used in the same statement that checks it, so two racing requests
    // with the same code can never both succeed.
    const claimed = await this.prisma.loginCode.updateMany({
      where: { code, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new UnauthorizedException("This sign-in link has expired. Please sign in with HubSpot again.");
    }
    const { userId } = await this.prisma.loginCode.findUniqueOrThrow({ where: { code } });
    const user = await this.usersService.findSafeById(userId);
    if (!user) {
      throw new UnauthorizedException("Your account no longer exists");
    }
    await this.assertBrandActive(user.brandId);
    return this.issueSession(user);
  }

  /** Local development only: sign in as the seeded demo business's admin. */
  async devLogin(): Promise<LoginResponseDto> {
    if (!this.env.DEV_LOGIN_ENABLED || this.env.NODE_ENV === "production") {
      throw new ForbiddenException("Dev login is disabled");
    }
    const brand = await this.prisma.brand.findUnique({ where: { hubspotPortalId: DEV_PORTAL_ID } });
    if (!brand) {
      throw new UnauthorizedException("Run `npm run db:seed` first to create the demo business.");
    }
    const user = await this.prisma.user.findFirst({
      where: { brandId: brand.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, brandId: true, email: true, name: true, role: true },
    });
    if (!user) {
      throw new UnauthorizedException("The demo business has no user. Re-run `npm run db:seed`.");
    }
    return this.issueSession(user);
  }

  private async assertBrandActive(brandId: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id: brandId }, select: { status: true } });
    if (!brand || brand.status !== BrandStatus.ACTIVE) {
      throw new ForbiddenException("The app is not installed in this HubSpot account. Reinstall it from HubSpot.");
    }
  }
}
