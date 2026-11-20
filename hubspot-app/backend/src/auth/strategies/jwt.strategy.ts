import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { BrandStatus } from "@prisma/client";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../../common/prisma/prisma.service";
import { Env } from "../../config/env.schema";
import { AuthUserDto } from "../dto/auth-user.dto";
import { APP_ENV } from "../../config/env.token";
import { JwtPayload } from "../dto/jwt-payload.type";

/** How long a "still valid" answer is trusted before the database is asked again. */
const RECHECK_MS = 30 * 1000;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly checked = new Map<string, { at: number; user: AuthUserDto | null }>();

  constructor(
    @Inject(APP_ENV) env: Env,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.JWT_SECRET,
    });
  }

  /**
   * Return value becomes `req.user`. The signed token says who signed in, but
   * the user, their role and the business's install status are re-read from the
   * database (cached for 30 seconds), so removing someone, demoting an admin or
   * uninstalling the app takes effect almost immediately rather than when the
   * token expires. A token from before multi-business sessions (no brandId) is refused.
   */
  async validate(payload: JwtPayload): Promise<AuthUserDto> {
    if (!payload.brandId) {
      throw new UnauthorizedException("Session is out of date. Please sign in again.");
    }
    const key = `${payload.sub}:${payload.brandId}`;
    const hit = this.checked.get(key);
    let user = hit && Date.now() - hit.at < RECHECK_MS ? hit.user : undefined;
    if (user === undefined) {
      const row = await this.prisma.user.findFirst({
        where: { id: payload.sub, brandId: payload.brandId, brand: { status: BrandStatus.ACTIVE } },
        select: { id: true, brandId: true, email: true, role: true },
      });
      user = row ? { ...row, name: "" } : null;
      this.checked.set(key, { at: Date.now(), user });
      if (this.checked.size > 5000) this.checked.clear();
    }
    if (!user) {
      throw new UnauthorizedException("Your access has ended. Please sign in with HubSpot again.");
    }
    return user;
  }
}
