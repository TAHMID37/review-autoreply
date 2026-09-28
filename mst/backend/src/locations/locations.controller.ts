import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { LocationsService } from "./locations.service";

@Controller("locations")
@UseGuards(JwtAuthGuard)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  findAll(@Query("brandId") brandId?: string) {
    return this.locationsService.findAll(brandId);
  }

  @Get(":id")
  findById(@Param("id") id: string) {
    return this.locationsService.findById(id);
  }
}
