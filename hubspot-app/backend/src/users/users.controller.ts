import { Body, Controller, ForbiddenException, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { IsEnum } from "class-validator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthUserDto } from "../auth/dto/auth-user.dto";
import { AdminGuard } from "../auth/guards/admin.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UsersService } from "./users.service";

class SetRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;
}

/** The business's team: everyone who has signed in to it through HubSpot. */
@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@CurrentUser() user: AuthUserDto) {
    return this.users.listForBrand(user.brandId);
  }

  @Patch(":id/role")
  @UseGuards(AdminGuard)
  async setRole(@CurrentUser() user: AuthUserDto, @Param("id") id: string, @Body() dto: SetRoleDto) {
    if (id === user.id && dto.role !== UserRole.ADMIN) {
      throw new ForbiddenException("You can't remove your own admin access. Ask another admin.");
    }
    await this.users.setRole(user.brandId, id, dto.role);
    return this.users.listForBrand(user.brandId);
  }
}
