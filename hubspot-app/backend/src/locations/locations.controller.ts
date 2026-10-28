import { Body, Controller, Get, Param, Put, UseGuards } from "@nestjs/common";
import { IsArray, IsString } from "class-validator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthUserDto } from "../auth/dto/auth-user.dto";
import { AdminGuard } from "../auth/guards/admin.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { LocationsService } from "./locations.service";

class LocationSelectionDto {
  @IsArray()
  @IsString({ each: true })
  locationIds!: string[];
}

@Controller("locations")
@UseGuards(JwtAuthGuard)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUserDto) {
    return this.locationsService.findAll(user.brandId);
  }

  /** Admins only, because it changes the bill. */
  @Put("selection")
  @UseGuards(AdminGuard)
  setSelection(@CurrentUser() user: AuthUserDto, @Body() dto: LocationSelectionDto) {
    return this.locationsService.setSelection(user.brandId, dto.locationIds);
  }

  @Get(":id")
  findById(@CurrentUser() user: AuthUserDto, @Param("id") id: string) {
    return this.locationsService.findById(user.brandId, id);
  }
}
