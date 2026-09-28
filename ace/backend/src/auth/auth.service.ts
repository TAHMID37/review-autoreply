import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { AuthUserDto, LoginResponseDto } from "./dto/auth-user.dto";
import { UsersService } from "../users/users.service";
import { JwtPayload } from "./dto/jwt-payload.type";

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  /** Verifies email/password and returns the safe user shape, or throws. */
  async validateCredentials(email: string, password: string): Promise<AuthUserDto> {
    const user = await this.usersService.findForAuthByEmail(email);
    if (!user) {
      // Same error for "no such user" and "wrong password" so a login form
      // can't be used to enumerate which emails have an account.
      throw new UnauthorizedException("Invalid email or password");
    }

    const passwordMatches = await argon2.verify(user.passwordHash, password);
    if (!passwordMatches) {
      throw new UnauthorizedException("Invalid email or password");
    }

    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }

  login(user: AuthUserDto): LoginResponseDto {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return { accessToken: this.jwtService.sign(payload), user };
  }
}
