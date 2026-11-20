import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { BrandStatus } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { Env } from "../config/env.schema";
import { APP_ENV } from "../config/env.token";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Checked a few times a day; deletion is never urgent to the minute. */
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

/**
 * Deletes what we hold for a business once it has been uninstalled for
 * RETENTION_DAYS: its reviews, reviewer names, replies, settings and users.
 * Only OUR database is touched. The notes, contacts and properties we added
 * to the business's own HubSpot are theirs and are never removed.
 *
 * Reinstalling clears `uninstalledAt`, so a business that comes back inside the
 * window keeps everything. Only UNINSTALLED businesses with a recorded
 * uninstall date are ever eligible, so an active business can never be purged.
 */
@Injectable()
export class RetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetentionService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    if (!this.env.RETENTION_ENABLED) {
      this.logger.warn("Data retention is off (RETENTION_ENABLED=false): uninstalled businesses are kept indefinitely.");
      return;
    }
    this.logger.log(`Uninstalled businesses are deleted from our database after ${this.env.RETENTION_DAYS} days.`);
    this.timer = setInterval(() => {
      this.purgeExpired().catch((e) => this.logger.error(`Retention run failed: ${e instanceof Error ? e.message : e}`));
    }, CHECK_EVERY_MS);
    this.timer.unref?.();
    // Also once shortly after start, so a server that restarts often still catches up.
    setTimeout(() => this.purgeExpired().catch(() => undefined), 60 * 1000).unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Deletes every business uninstalled for at least RETENTION_DAYS. Returns how many. */
  async purgeExpired(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - this.env.RETENTION_DAYS * DAY_MS);
    const expired = await this.prisma.brand.findMany({
      where: { status: BrandStatus.UNINSTALLED, uninstalledAt: { not: null, lte: cutoff } },
      select: { id: true, hubspotPortalId: true },
    });

    for (const brand of expired) {
      const users = await this.prisma.user.findMany({ where: { brandId: brand.id }, select: { id: true } });
      await this.prisma.$transaction([
        this.prisma.loginCode.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } }),
        this.prisma.jobRunLog.deleteMany({ where: { brandId: brand.id } }),
        // Cascades to users, locations, reviews, replies, widgets, tokens and billing records.
        this.prisma.brand.delete({ where: { id: brand.id } }),
      ]);
      this.logger.warn(`Deleted business ${brand.id} (portal ${brand.hubspotPortalId}) after ${this.env.RETENTION_DAYS} days uninstalled.`);
    }
    return expired.length;
  }
}
