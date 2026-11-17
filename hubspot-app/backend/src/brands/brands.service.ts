import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { HubSpotInstallStatus, PlatformAccountStatus } from "@prisma/client";
import { BillingService } from "../billing/billing.service";
import { PrismaService } from "../common/prisma/prisma.service";
import { AutoReplySettingDto, UpdateBrandDto } from "./dto/update-brand.dto";

const BRAND_SELECT = {
  id: true,
  name: true,
  status: true,
  hubspotPortalId: true,
  hubspotDomain: true,
  tone: true,
  language: true,
  forbiddenWords: true,
  autoReplyEnabled: true,
  autoReplyConsentAt: true,
  autoReplyStartAt: true,
  alertEmails: true,
  crmSyncEnabled: true,
  newContactPolicy: true,
  reportFrequency: true,
  hubspotPropertiesReadyAt: true,
  hubspotPropertiesBlockedReason: true,
  createdAt: true,
} as const;

/**
 * The signed-in user's own business. Every method takes the caller's brandId,
 * so one business can never read or change another's settings.
 */
@Injectable()
export class BrandsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
  ) {}

  /** After freeing up property space in HubSpot: the next sync tries again. */
  async retryProperties(brandId: string): Promise<{ ok: true }> {
    await this.prisma.brand.update({
      where: { id: brandId },
      data: { hubspotPropertiesVersion: 0, hubspotPropertiesBlockedReason: null },
    });
    return { ok: true };
  }

  /** The setup checklist: what this business still has to do to go live. */
  async getSetup(brandId: string) {
    const [brand, installation, googleAccounts, locations, syncedLocations, subscription] = await Promise.all([
      this.prisma.brand.findUniqueOrThrow({ where: { id: brandId }, select: { autoReplyEnabled: true } }),
      this.prisma.hubSpotInstallation.findUnique({ where: { brandId }, select: { status: true } }),
      this.prisma.platformAccount.count({ where: { brandId, status: PlatformAccountStatus.CONNECTED } }),
      this.prisma.location.count({ where: { brandId } }),
      this.prisma.location.count({ where: { brandId, syncEnabled: true } }),
      this.prisma.subscription.findUnique({ where: { brandId } }),
    ]);
    const steps = {
      hubspotConnected: installation?.status === HubSpotInstallStatus.INSTALLED,
      googleConnected: googleAccounts > 0,
      locationsSelected: syncedLocations > 0,
      planChosen: !this.billing.enforced || this.billing.isServiceActive(subscription),
      autoReplyEnabled: brand.autoReplyEnabled,
    };
    return {
      steps,
      locationsFound: locations,
      locationsSelected: syncedLocations,
      billingEnforced: this.billing.enforced,
      // Auto-replies are optional, so they do not hold up "set up".
      complete: steps.hubspotConnected && steps.googleConnected && steps.locationsSelected && steps.planChosen,
    };
  }

  /** A list of one, so screens written for the multi-brand API keep working. */
  async findAll(brandId: string) {
    return [await this.findById(brandId, brandId)];
  }

  async findById(brandId: string, id: string) {
    if (id !== brandId) {
      throw new NotFoundException(`Brand ${id} not found`);
    }
    const brand = await this.prisma.brand.findUnique({ where: { id }, select: BRAND_SELECT });
    if (!brand) {
      throw new NotFoundException(`Brand ${id} not found`);
    }
    return brand;
  }

  async update(brandId: string, id: string, dto: UpdateBrandDto) {
    const current = await this.findById(brandId, id);
    const { alertEmails, name, ...rest } = dto;
    // Switching reports on starts the clock now, so the first email goes out at
    // the next week/month boundary rather than straight away.
    const reportsSwitchedOn =
      dto.reportFrequency !== undefined && dto.reportFrequency !== "NONE" && dto.reportFrequency !== current.reportFrequency;
    await this.prisma.brand.update({
      where: { id },
      data: {
        ...rest,
        ...(reportsSwitchedOn ? { reportLastSentAt: new Date() } : {}),
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(alertEmails !== undefined ? { alertEmails: [...new Set(alertEmails.map((e) => e.trim().toLowerCase()))] } : {}),
      },
    });
    return this.findById(brandId, id);
  }

  /**
   * Turns auto-replies on (with recorded consent) or off. Turning them on sets
   * the start time to now, so only reviews left from now on are auto-replied -
   * the business's existing backlog is never touched.
   */
  async setAutoReply(brandId: string, userId: string, dto: AutoReplySettingDto) {
    if (dto.enabled && dto.consent !== true) {
      throw new BadRequestException("Tick the consent box to let the app post replies on Google for your business.");
    }
    const now = new Date();
    await this.prisma.brand.update({
      where: { id: brandId },
      data: dto.enabled
        ? { autoReplyEnabled: true, autoReplyConsentAt: now, autoReplyConsentByUserId: userId, autoReplyStartAt: now }
        : { autoReplyEnabled: false },
    });
    return this.findById(brandId, brandId);
  }
}
