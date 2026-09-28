import { Inject, Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Env } from "../../config/env.schema";
import { AuthUserDto } from "../dto/auth-user.dto";
import { APP_ENV } from "../../config/env.token";
import { JwtPayload } from "../dto/jwt-payload.type";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(APP_ENV) env: Env) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.JWT_SECRET,
    });
  }

  /** Return value becomes `req.user`. Trusts the signed payload as-is —
   *  no extra DB lookup per request; role changes take effect on next login. */
  validate(payload: JwtPayload): AuthUserDto {
    return { id: payload.sub, email: payload.email, role: payload.role, name: "" };
  }
}
