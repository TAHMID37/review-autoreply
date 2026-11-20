import { BadRequestException, Controller, HttpCode, HttpStatus, Inject, Logger, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { PrismaService } from "../common/prisma/prisma.service";
import { Env } from "../config/env.schema";
import { APP_ENV } from "../config/env.token";
import { HubSpotInstallService } from "./hubspot-install.service";
import { verifyHubSpotSignatureV3 } from "./hubspot-signature";

/** What we read from one HubSpot event. HubSpot's field names vary by API version, so all are optional. */
interface HubSpotEvent {
  eventId?: string | number;
  portalId?: string | number;
  hubId?: string | number;
  accountId?: string | number;
  subscriptionType?: string;
  eventType?: string;
  type?: string;
}

/**
 * HubSpot's event deliveries (app lifecycle). Today this acts on one event:
 * the app being uninstalled from an account. Authenticated by HubSpot's
 * X-HubSpot-Signature-v3 header, like the app cards.
 *
 * Anything that is not recognisably an uninstall is acknowledged and ignored,
 * and its type is logged so the subscription can be checked against what
 * HubSpot really sends.
 */
@Controller("hubspot/webhooks")
export class HubSpotWebhooksController {
  private readonly logger = new Logger(HubSpotWebhooksController.name);

  constructor(
    private readonly install: HubSpotInstallService,
    private readonly prisma: PrismaService,
    @Inject(APP_ENV) private readonly env: Env,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async receive(@Req() req: Request & { rawBody?: Buffer }): Promise<{ received: number; uninstalled: number }> {
    const body = req.rawBody ? req.rawBody.toString("utf8") : "";
    const verified = verifyHubSpotSignatureV3({
      clientSecret: this.env.HUBSPOT_CLIENT_SECRET,
      method: req.method,
      uri: `${this.env.API_PUBLIC_URL.replace(/\/$/, "")}${req.originalUrl}`,
      body,
      timestamp: header(req, "x-hubspot-request-timestamp"),
      signature: header(req, "x-hubspot-signature-v3"),
    });
    if (!verified.ok) {
      this.logger.warn(`Rejected HubSpot webhook: ${verified.reason}`);
      throw new UnauthorizedException("Invalid HubSpot signature");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new BadRequestException("Body is not JSON");
    }
    const events = (Array.isArray(parsed) ? parsed : [parsed]) as HubSpotEvent[];

    let uninstalled = 0;
    for (const event of events) {
      if (!isUninstall(event)) {
        this.logger.log(`Ignored HubSpot event of type "${eventName(event) || "unknown"}".`);
        continue;
      }
      const portalId = event.portalId ?? event.hubId ?? event.accountId;
      if (portalId == null) {
        this.logger.warn("HubSpot uninstall event had no account id; ignored.");
        continue;
      }
      const eventId = event.eventId != null ? `hubspot:${event.eventId}` : null;
      if (eventId && (await this.prisma.processedWebhookEvent.findUnique({ where: { id: eventId } }))) continue;
      if (await this.install.handleUninstalledByHubSpot(String(portalId))) uninstalled++;
      if (eventId) await this.prisma.processedWebhookEvent.create({ data: { id: eventId, source: "hubspot" } });
    }
    return { received: events.length, uninstalled };
  }
}

function eventName(event: HubSpotEvent): string {
  return String(event.subscriptionType ?? event.eventType ?? event.type ?? "");
}

/** True for an app-uninstall event, whichever field HubSpot names it in. */
export function isUninstall(event: HubSpotEvent): boolean {
  return /uninstall/i.test(eventName(event));
}

function header(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}
