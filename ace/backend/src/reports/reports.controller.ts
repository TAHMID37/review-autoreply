import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ReportsService } from "./reports.service";

@Controller("reports")
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("stats")
  getStats(@Query("brandId") brandId?: string) {
    return this.reports.getStats(brandId);
  }

  @Get("weekly-volume")
  getWeeklyVolume(@Query("brandId") brandId?: string) {
    return this.reports.getWeeklyVolume(brandId);
  }
}
