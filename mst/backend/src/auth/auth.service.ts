import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { AuthUserDto, LoginResponseDto } from "./dto/auth-user.dto";
import { UsersService } from "../users/users.service";
import { JwtPayload } from "./dto/jwt-payload.type";
import { UpdateAccountDto } from "./dto/update-account.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  /** Emails are stored and compared in this form, so capitalisation or a
   *  stray space in the login box never locks someone out of their account. */
  static normaliseEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /** Verifies email/password and returns the safe user shape, or throws. */
  async validateCredentials(email: string, password: string): Promise<AuthUserDto> {
    const user = await this.usersService.findForAuthByEmail(AuthService.normaliseEmail(email));
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

  /**
   * Changes the signed-in user's own login details (name, email, password).
   *
   * Returns a fresh session rather than just the user: the JWT carries the
   * email, so after an email change the old token describes an address that no
   * longer exists. Handing back a new token keeps the dashboard signed in
   * instead of bouncing her to the login screen mid-edit.
   */
  async updateAccount(userId: string, dto: UpdateAccountDto): Promise<LoginResponseDto> {
    const user = await this.usersService.findForAuthById(userId);
    if (!user) {
      throw new UnauthorizedException("Your account no longer exists");
    }

    const currentPasswordMatches = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!currentPasswordMatches) {
      throw new UnauthorizedException("Current password is incorrect");
    }

    const data: { name?: string; email?: string; passwordHash?: string } = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }

    if (dto.email !== undefined) {
      const email = AuthService.normaliseEmail(dto.email);
      if (email !== user.email) {
        if (await this.usersService.isEmailTakenByAnother(email, userId)) {
          throw new ConflictException("That email is already used by another account");
        }
        data.email = email;
      }
    }

    if (dto.newPassword !== undefined) {
      data.passwordHash = await argon2.hash(dto.newPassword);
    }

    const updated = await this.usersService.updateAccount(userId, data);
    return this.login(updated);
  }
}
