import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { BillingService } from "../billing/billing.service";
import { PrismaService } from "../common/prisma/prisma.service";

@Injectable()
export class LocationsService {
  private readonly logger = new Logger(LocationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
  ) {}

  findAll(brandId: string) {
    return this.prisma.location.findMany({
      where: { brandId },
      orderBy: { name: "asc" },
      include: { _count: { select: { reviews: true } } },
    });
  }

  async findById(brandId: string, id: string) {
    const location = await this.prisma.location.findFirst({ where: { id, brandId } });
    if (!location) {
      throw new NotFoundException(`Location ${id} not found`);
    }
    return location;
  }

  /**
   * The location picker: exactly the given locations are synced (and billed);
   * every other location of this business is switched off. Unticking a
   * location stops syncing it but keeps its reviews.
   */
  async setSelection(brandId: string, locationIds: string[]) {
    const ids = [...new Set(locationIds)];
    const owned = await this.prisma.location.count({ where: { brandId, id: { in: ids } } });
    if (owned !== ids.length) {
      throw new BadRequestException("One or more locations do not belong to this business.");
    }
    await this.prisma.$transaction([
      this.prisma.location.updateMany({ where: { brandId, id: { in: ids } }, data: { syncEnabled: true } }),
      this.prisma.location.updateMany({ where: { brandId, id: { notIn: ids } }, data: { syncEnabled: false } }),
    ]);
    // Billing follows the selection. A Stripe hiccup must not undo the change;
    // the quantity is re-checked on the next selection change.
    await this.billing
      .syncQuantity(brandId)
      .catch((e) => this.logger.error(`Billing quantity update failed for ${brandId}: ${e instanceof Error ? e.message : e}`));
    return this.findAll(brandId);
  }
}
