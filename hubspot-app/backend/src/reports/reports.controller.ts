import { Controller, Get, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthUserDto } from "../auth/dto/auth-user.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ReportsService } from "./reports.service";

@Controller("reports")
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("stats")
  getStats(@CurrentUser() user: AuthUserDto) {
    return this.reports.getStats(user.brandId);
  }

  @Get("weekly-volume")
  getWeeklyVolume(@CurrentUser() user: AuthUserDto) {
    return this.reports.getWeeklyVolume(user.brandId);
  }
}
