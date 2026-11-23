import { BadRequestException, Controller, Get, Header, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthUserDto } from "../auth/dto/auth-user.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ReportPeriod } from "./report-periods";
import { ReportsService } from "./reports.service";

const PERIODS: ReportPeriod[] = ["week", "month", "year"];

function parsePeriod(value?: string): ReportPeriod {
  if (!value) return "month";
  if (!PERIODS.includes(value as ReportPeriod)) throw new BadRequestException("period must be week, month or year");
  return value as ReportPeriod;
}

@Controller("reports")
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("stats")
  getStats(@CurrentUser() user: AuthUserDto, @Query("locationId") locationId?: string) {
    return this.reports.getStats(user.brandId, locationId || undefined);
  }

  @Get("weekly-volume")
  getWeeklyVolume(@CurrentUser() user: AuthUserDto, @Query("locationId") locationId?: string) {
    return this.reports.getWeeklyVolume(user.brandId, locationId || undefined);
  }

  /** Weekly, monthly or yearly report: ?period=week|month|year&locationId= */
  @Get("period")
  getPeriod(@CurrentUser() user: AuthUserDto, @Query("period") period?: string, @Query("locationId") locationId?: string) {
    return this.reports.getPeriodReport(user.brandId, parsePeriod(period), locationId || undefined);
  }

  @Get("period.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="review-report.csv"')
  getPeriodCsv(@CurrentUser() user: AuthUserDto, @Query("period") period?: string, @Query("locationId") locationId?: string) {
    return this.reports.getPeriodCsv(user.brandId, parsePeriod(period), locationId || undefined);
  }

  /** Rating goal calculator: ?target=4.5&locationId=&rounded=false */
  @Get("rating-goal")
  getRatingGoal(
    @CurrentUser() user: AuthUserDto,
    @Query("target") target?: string,
    @Query("locationId") locationId?: string,
    @Query("rounded") rounded?: string,
  ) {
    const parsed = Number(target);
    if (!target || !Number.isFinite(parsed)) throw new BadRequestException("target must be a number such as 4.5");
    return this.reports.getRatingGoal(user.brandId, parsed, locationId || undefined, rounded !== "false");
  }
}
