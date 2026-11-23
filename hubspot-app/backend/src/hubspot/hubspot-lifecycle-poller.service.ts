import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { Env } from "../config/env.schema";
import { APP_ENV } from "../config/env.token";
import { HubSpotInstallService } from "./hubspot-install.service";
import { extractUninstalls, UNINSTALL_EVENT_TYPE_ID } from "./lifecycle-events";

const API = "https://api.hubapi.com";
const SCOPES = "developer.webhooks_journal.read developer.webhooks_journal.subscriptions.read developer.webhooks_journal.subscriptions.write";
const PAGE_SIZE = 100;
const MAX_PAGES = 20;
/** Renew the app-level token a little before HubSpot's 30 minutes are up. */
const TOKEN_REUSE_MS = 25 * 60 * 1000;

/**
 * HubSpot does not push uninstall events; they are written to a journal the app
 * reads. This polls that journal and runs the normal uninstall cleanup (Google
 * disconnected, billing cancelled, retention clock started) for each account
 * that removed the app. The journal keeps about 3 days, and every event is
 * recorded once processed, so re-reading it is harmless.
 */
@Injectable()
export class HubSpotLifecyclePollerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HubSpotLifecyclePollerService.name);
  private timer?: NodeJS.Timeout;
  private token: { value: string; at: number } | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly install: HubSpotInstallService,
    @Inject(APP_ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    if (!this.env.HUBSPOT_UNINSTALL_POLL_ENABLED) {
      this.logger.log("HubSpot uninstall polling is off (set HUBSPOT_UNINSTALL_POLL_ENABLED=true to enable).");
      return;
    }
    const everyMs = this.env.HUBSPOT_UNINSTALL_POLL_INTERVAL_MIN * 60 * 1000;
    this.logger.log(`Polling HubSpot for uninstall events every ${this.env.HUBSPOT_UNINSTALL_POLL_INTERVAL_MIN} min.`);
    void this.tick();
    this.timer = setInterval(() => void this.tick(), everyMs);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.ensureSubscription();
      await this.readJournal();
    } catch (error) {
      this.logger.error(`HubSpot uninstall poll failed: ${error instanceof Error ? error.message : error}`);
    } finally {
      this.running = false;
    }
  }

  /** Creates the uninstall subscription if the app does not have one yet. */
  private async ensureSubscription(): Promise<void> {
    const list = await this.call<{ results?: { objectTypeId?: string; subscriptionType?: string }[] }>("GET", "/webhooks-journal/subscriptions/2026-09");
    const has = (list.results ?? []).some((s) => s.objectTypeId === UNINSTALL_EVENT_TYPE_ID || s.subscriptionType === "APP_LIFECYCLE_EVENT");
    if (has) return;
    await this.call("POST", "/webhooks-journal/subscriptions/2026-09", { subscriptionType: "APP_LIFECYCLE_EVENT", eventTypeId: UNINSTALL_EVENT_TYPE_ID });
    this.logger.log("Subscribed to HubSpot app-uninstall events.");
  }

  private async readJournal(): Promise<void> {
    let path = `/webhooks-journal/journal/2026-09/batch/earliest/${PAGE_SIZE}`;
    for (let page = 0; page < MAX_PAGES; page++) {
      const batch = await this.call<unknown>("GET", path);
      const { events, lastOffset } = extractUninstalls(batch);
      for (const event of events) await this.handle(event);
      const count = Array.isArray((batch as { results?: unknown[] } | null)?.results) ? (batch as { results: unknown[] }).results.length : 0;
      if (!lastOffset || count < PAGE_SIZE) return;
      path = `/webhooks-journal/journal/2026-09/batch/${lastOffset}/next/${PAGE_SIZE}`;
    }
  }

  private async handle(event: { offset: string | null; portalId: string; occurredAt: Date | null }): Promise<void> {
    const id = `hubspot-journal:${event.offset ?? `${event.portalId}:${event.occurredAt?.toISOString() ?? "unknown"}`}`;
    if (await this.prisma.processedWebhookEvent.findUnique({ where: { id } })) return;

    // If the business signed in again after the event, it was reinstalled: leave it alone.
    const brand = await this.prisma.brand.findUnique({
      where: { hubspotPortalId: event.portalId },
      select: { hubspotInstallation: { select: { updatedAt: true } } },
    });
    const reinstalled = event.occurredAt && brand?.hubspotInstallation && brand.hubspotInstallation.updatedAt > event.occurredAt;
    if (!reinstalled && (await this.install.handleUninstalledByHubSpot(event.portalId))) {
      this.logger.warn(`HubSpot reported the app was uninstalled from account ${event.portalId}; cleaned up.`);
    }
    await this.prisma.processedWebhookEvent.create({ data: { id, source: "hubspot-journal" } });
  }

  /** An app-level (client credentials) token: the journal belongs to the app, not to one account. */
  private async appToken(): Promise<string> {
    if (this.token && Date.now() - this.token.at < TOKEN_REUSE_MS) return this.token.value;
    const response = await fetch(`${API}/oauth/v1/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.env.HUBSPOT_CLIENT_ID,
        client_secret: this.env.HUBSPOT_CLIENT_SECRET,
        scope: SCOPES,
      }),
    });
    const json = (await response.json().catch(() => ({}))) as { access_token?: string; message?: string };
    if (!response.ok || !json.access_token) throw new Error(`HubSpot app token failed (${response.status}): ${json.message ?? "no token"}`);
    this.token = { value: json.access_token, at: Date.now() };
    return json.access_token;
  }

  private async call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${await this.appToken()}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status === 204) return {} as T;
    if (!response.ok) throw new Error(`HubSpot ${method} ${path} -> ${response.status}`);
    return (await response.json()) as T;
  }
}
