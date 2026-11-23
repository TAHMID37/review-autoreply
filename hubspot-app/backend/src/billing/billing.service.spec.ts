import { SubscriptionStatus } from "@prisma/client";
import { BillingService } from "./billing.service";

const DAY = 24 * 60 * 60 * 1000;

function service(env: Record<string, unknown> = {}) {
  const prisma = { subscription: { findUnique: jest.fn(), create: jest.fn() } };
  const stripe = { configured: true };
  const full = { BILLING_ENFORCED: true, STRIPE_TRIAL_DAYS: 90, BILLING_GRACE_DAYS: 7, ...env };
  return { svc: new BillingService(prisma as never, stripe as never, full as never), prisma };
}

const sub = (over: Record<string, unknown>) => ({ status: SubscriptionStatus.TRIALING, pastDueSince: null, stripeSubscriptionId: null, trialEndsAt: null, ...over }) as never;

describe("free trial without a card", () => {
  it("is active until its end date", () => {
    const { svc } = service();
    expect(svc.isServiceActive(sub({ trialEndsAt: new Date(Date.now() + DAY) }))).toBe(true);
    expect(svc.isServiceActive(sub({ trialEndsAt: new Date(Date.now() - DAY) }))).toBe(false);
    expect(svc.isServiceActive(sub({ trialEndsAt: null }))).toBe(false);
  });

  it("trusts Stripe once a subscription exists", () => {
    const { svc } = service();
    expect(svc.isServiceActive(sub({ stripeSubscriptionId: "sub_1", trialEndsAt: new Date(Date.now() - DAY) }))).toBe(true);
  });

  it("starts once, for a business with no subscription record", async () => {
    const { svc, prisma } = service();
    prisma.subscription.findUnique.mockResolvedValueOnce(null);
    await svc.startTrial("b1");
    expect(prisma.subscription.create).toHaveBeenCalledTimes(1);
    const data = prisma.subscription.create.mock.calls[0][0].data;
    expect(data.status).toBe(SubscriptionStatus.TRIALING);
    expect(data.trialEndsAt.getTime()).toBeGreaterThan(Date.now() + 89 * DAY);

    prisma.subscription.findUnique.mockResolvedValueOnce({ id: "x" });
    await svc.startTrial("b1");
    expect(prisma.subscription.create).toHaveBeenCalledTimes(1);
  });
});
