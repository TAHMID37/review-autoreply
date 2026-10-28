import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Post, UseGuards } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { UsersService } from "../users/users.service";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./decorators/current-user.decorator";
import { AuthUserDto, LoginResponseDto } from "./dto/auth-user.dto";
import { ExchangeCodeDto } from "./dto/exchange-code.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  /** Swaps the one-time code from the HubSpot sign-in redirect for a session. */
  @Post("exchange")
  @HttpCode(HttpStatus.OK)
  exchange(@Body() dto: ExchangeCodeDto): Promise<LoginResponseDto> {
    return this.authService.exchangeLoginCode(dto.code);
  }

  /** Development only (DEV_LOGIN_ENABLED=true): sign in as the demo business. */
  @Post("dev-login")
  @HttpCode(HttpStatus.OK)
  devLogin(): Promise<LoginResponseDto> {
    return this.authService.devLogin();
  }

  /** The current user plus the business they are signed in to. */
  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() currentUser: AuthUserDto) {
    const user = await this.usersService.findSafeById(currentUser.id);
    if (!user) {
      throw new NotFoundException("User no longer exists");
    }
    const brand = await this.prisma.brand.findUniqueOrThrow({
      where: { id: user.brandId },
      select: { id: true, name: true, hubspotPortalId: true, hubspotDomain: true },
    });
    return { ...user, brand };
  }
}
