import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Post, UseGuards } from "@nestjs/common";
import { AuthUserDto, LoginResponseDto } from "./dto/auth-user.dto";
import { UsersService } from "../users/users.service";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./decorators/current-user.decorator";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.authService.validateCredentials(dto.email, dto.password);
    return this.authService.login(user);
  }

  /** Lets the dashboard confirm the current session and fetch the up-to-date
   *  user record (including `name`, which isn't stored in the JWT). */
  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() currentUser: AuthUserDto): Promise<AuthUserDto> {
    const user = await this.usersService.findSafeById(currentUser.id);
    if (!user) {
      throw new NotFoundException("User no longer exists");
    }
    return user;
  }
}
