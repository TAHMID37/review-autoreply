import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import { Prisma, Subscription, SubscriptionStatus } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { Env } from "../config/env.schema";
import { APP_ENV } from "../config/env.token";
import { StripeClient, StripeEvent } from "./stripe.client";

const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_FROM_STRIPE: Record<string, SubscriptionStatus> = {
  trialing: SubscriptionStatus.TRIALING,
  active: SubscriptionStatus.ACTIVE,
  past_due: SubscriptionStatus.PAST_DUE,
  unpaid: SubscriptionStatus.UNPAID,
  canceled: SubscriptionStatus.CANCELED,
  incomplete: SubscriptionStatus.INCOMPLETE,
  incomplete_expired: SubscriptionStatus.CANCELED,
  paused: SubscriptionStatus.UNPAID,
};

interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end?: boolean;
  trial_end?: number | null;
  current_period_end?: number;
  metadata?: Record<string, string>;
  items: { data: { id: string; quantity?: number; current_period_end?: number }[] };
}

/**
 * Monthly subscription per synced location, through Stripe (HubSpot does not
 * bill for Marketplace apps). Stripe is the source of truth: this service only
 * starts Checkout / the billing portal and mirrors what Stripe's webhooks say.
 *
 * With billing not enforced (development, or before pricing is decided) every
 * business is treated as paid, so nothing else in the app has to care.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeClient,
    @Inject(APP_ENV) private readonly env: Env,
  ) {}

  get enforced(): boolean {
    return this.env.BILLING_ENFORCED && this.stripe.configured;
  }

  /** Whether syncing and auto-replies should run for this business right now. */
  isServiceActive(subscription: Pick<Subscription, "status" | "pastDueSince"> | null): boolean {
    if (!this.enforced) return true;
    if (!subscription) return false;
    if (subscription.status === SubscriptionStatus.ACTIVE || subscription.status === SubscriptionStatus.TRIALING) {
      return true;
    }
    if (subscription.status === SubscriptionStatus.PAST_DUE || subscription.status === SubscriptionStatus.UNPAID) {
      const since = subscription.pastDueSince?.getTime() ?? Date.now();
      return Date.now() < since + this.env.BILLING_GRACE_DAYS * DAY_MS;
    }
    return false;
  }

  /** Brand ids whose service is currently paid for (or billing is off). */
  async activeBrandFilter(): Promise<Prisma.BrandWhereInput> {
    if (!this.enforced) return {};
    const graceStart = new Date(Date.now() - this.env.BILLING_GRACE_DAYS * DAY_MS);
    return {
      subscription: {
        OR: [
          { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] } },
          { status: { in: [SubscriptionStatus.PAST_DUE, SubscriptionStatus.UNPAID] }, pastDueSince: { gt: graceStart } },
        ],
      },
    };
  }

  async getStatus(brandId: string) {
    const [subscription, syncedLocations] = await Promise.all([
      this.prisma.subscription.findUnique({ where: { brandId } }),
      this.prisma.location.count({ where: { brandId, syncEnabled: true } }),
    ]);
    return {
      enforced: this.enforced,
      configured: this.stripe.configured,
      status: subscription?.status ?? SubscriptionStatus.NONE,
      quantity: subscription?.quantity ?? 0,
      syncedLocations,
      trialDays: this.env.STRIPE_TRIAL_DAYS,
      trialEndsAt: subscription?.trialEndsAt ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      pastDueSince: subscription?.pastDueSince ?? null,
      graceDays: this.env.BILLING_GRACE_DAYS,
      serviceActive: this.isServiceActive(subscription),
    };
  }

  /** Starts Stripe Checkout for a new subscription; returns the URL to open. */
  async createCheckout(brandId: string, email: string): Promise<{ url: string }> {
    const existing = await this.prisma.subscription.findUnique({ where: { brandId } });
    if (existing && (existing.status === SubscriptionStatus.ACTIVE || existing.status === SubscriptionStatus.TRIALING)) {
      throw new BadRequestException("This business already has a subscription. Use Manage billing to change it.");
    }
    const quantity = await this.prisma.location.count({ where: { brandId, syncEnabled: true } });
    if (quantity === 0) {
      throw new BadRequestException("Pick at least one location before choosing a plan - billing is per location.");
    }
    const customerId = await this.ensureCustomer(brandId, email);
    const web = this.env.WEB_APP_URL.replace(/\/$/, "");
    // A trial only for a business that has never subscribed before.
    const trial = this.env.STRIPE_TRIAL_DAYS > 0 && !existing?.stripeSubscriptionId ? this.env.STRIPE_TRIAL_DAYS : undefined;

    const session = await this.stripe.request<{ url: string }>("POST", "/checkout/sessions", {
      mode: "subscription",
      customer: customerId,
      client_reference_id: brandId,
      line_items: [{ price: this.env.STRIPE_PRICE_ID, quantity }],
      subscription_data: { metadata: { brandId }, trial_period_days: trial },
      allow_promotion_codes: true,
      success_url: `${web}/billing?checkout=success`,
      cancel_url: `${web}/billing?checkout=cancelled`,
    });
    return { url: session.url };
  }

  /** Stripe's hosted portal: change card, cancel, download invoices. */
  async createPortal(brandId: string): Promise<{ url: string }> {
    const sub = await this.prisma.subscription.findUnique({ where: { brandId } });
    if (!sub?.stripeCustomerId) {
      throw new BadRequestException("Choose a plan first.");
    }
    const session = await this.stripe.request<{ url: string }>("POST", "/billing_portal/sessions", {
      customer: sub.stripeCustomerId,
      return_url: `${this.env.WEB_APP_URL.replace(/\/$/, "")}/billing`,
    });
    return { url: session.url };
  }

  /**
   * Keeps the billed quantity equal to the number of synced locations. Called
   * whenever a location is ticked or unticked. Stripe prorates the change.
   */
  async syncQuantity(brandId: string): Promise<void> {
    if (!this.stripe.configured) return;
    const sub = await this.prisma.subscription.findUnique({ where: { brandId } });
    if (!sub?.stripeSubscriptionId || sub.status === SubscriptionStatus.CANCELED) return;

    const quantity = Math.max(1, await this.prisma.location.count({ where: { brandId, syncEnabled: true } }));
    if (quantity === sub.quantity) return;

    const remote = await this.stripe.request<StripeSubscription>("GET", `/subscriptions/${sub.stripeSubscriptionId}`);
    const item = remote.items.data[0];
    if (!item) return;
    await this.stripe.request("POST", `/subscription_items/${item.id}`, {
      quantity,
      proration_behavior: "create_prorations",
    });
    await this.prisma.subscription.update({ where: { brandId }, data: { quantity } });
    this.logger.log(`Billing quantity for ${brandId} -> ${quantity} location(s).`);
  }

  async cancelImmediately(brandId: string): Promise<void> {
    const sub = await this.prisma.subscription.findUnique({ where: { brandId } });
    if (!sub?.stripeSubscriptionId || sub.status === SubscriptionStatus.CANCELED || !this.stripe.configured) return;
    await this.stripe.request("DELETE", `/subscriptions/${sub.stripeSubscriptionId}`);
    await this.prisma.subscription.update({ where: { brandId }, data: { status: SubscriptionStatus.CANCELED } });
  }

  /** Applies a verified Stripe webhook event. Redelivered events are ignored. */
  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined): Promise<void> {
    if (!rawBody) throw new BadRequestException("Missing body");
    const event = this.stripe.constructEvent(rawBody, signature);

    const already = await this.prisma.processedWebhookEvent.findUnique({ where: { id: event.id } });
    if (already) return;

    await this.applyEvent(event);
    await this.prisma.processedWebhookEvent.create({ data: { id: event.id, source: "stripe" } });
  }

  private async applyEvent(event: StripeEvent): Promise<void> {
    const obj = event.data.object;
    switch (event.type) {
      case "checkout.session.completed": {
        const brandId = obj.client_reference_id as string | undefined;
        const subId = obj.subscription as string | undefined;
        if (brandId && subId) {
          const sub = await this.stripe.request<StripeSubscription>("GET", `/subscriptions/${subId}`);
          await this.applySubscription(sub, brandId);
        }
        return;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await this.applySubscription(obj as unknown as StripeSubscription);
        return;
      case "invoice.payment_failed":
        await this.prisma.subscription.updateMany({
          where: { stripeCustomerId: obj.customer as string, pastDueSince: null },
          data: { pastDueSince: new Date() },
        });
        return;
      case "invoice.paid":
        await this.prisma.subscription.updateMany({
          where: { stripeCustomerId: obj.customer as string },
          data: { pastDueSince: null },
        });
        return;
      default:
        return;
    }
  }

  private async applySubscription(sub: StripeSubscription, brandIdHint?: string): Promise<void> {
    const byCustomer = await this.prisma.subscription.findUnique({ where: { stripeCustomerId: sub.customer } });
    const brandId = brandIdHint ?? sub.metadata?.brandId ?? byCustomer?.brandId;
    if (!brandId) {
      this.logger.warn(`Stripe subscription ${sub.id} has no business attached - ignored.`);
      return;
    }
    const status = STATUS_FROM_STRIPE[sub.status] ?? SubscriptionStatus.INCOMPLETE;
    const item = sub.items?.data?.[0];
    const periodEnd = item?.current_period_end ?? sub.current_period_end;
    const failing = status === SubscriptionStatus.PAST_DUE || status === SubscriptionStatus.UNPAID;

    const data = {
      stripeCustomerId: sub.customer,
      stripeSubscriptionId: sub.id,
      status,
      quantity: item?.quantity ?? 0,
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    };
    const current = await this.prisma.subscription.findUnique({ where: { brandId } });
    await this.prisma.subscription.upsert({
      where: { brandId },
      create: { brandId, ...data, pastDueSince: failing ? new Date() : null },
      update: { ...data, pastDueSince: failing ? (current?.pastDueSince ?? new Date()) : null },
    });
  }

  private async ensureCustomer(brandId: string, email: string): Promise<string> {
    const sub = await this.prisma.subscription.findUnique({ where: { brandId } });
    if (sub?.stripeCustomerId) return sub.stripeCustomerId;
    const brand = await this.prisma.brand.findUniqueOrThrow({ where: { id: brandId } });
    const customer = await this.stripe.request<{ id: string }>("POST", "/customers", {
      email,
      name: brand.name,
      metadata: { brandId, hubspotPortalId: brand.hubspotPortalId ?? "" },
    });
    await this.prisma.subscription.upsert({
      where: { brandId },
      create: { brandId, stripeCustomerId: customer.id },
      update: { stripeCustomerId: customer.id },
    });
    return customer.id;
  }
}
