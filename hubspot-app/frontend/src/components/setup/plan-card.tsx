"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { BillingStatus } from "@/types/api";
import { AdminOnlyHint, Card, errorText, Notice, PRIMARY_BUTTON, SECONDARY_BUTTON } from "./ui";

const STATUS_LABEL: Record<BillingStatus["status"], string> = {
  NONE: "No plan yet",
  TRIALING: "Free trial",
  ACTIVE: "Active",
  PAST_DUE: "Payment failed",
  UNPAID: "Payment failed",
  CANCELED: "Cancelled",
  INCOMPLETE: "Awaiting payment",
};

/** The plan summary + Stripe Checkout / billing portal buttons. */
export function PlanCard({ reloadKey = 0 }: { reloadKey?: number }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch<BillingStatus>("/billing")
      .then(setBilling)
      .catch((err) => setError(err.message));
  }, [reloadKey]);

  async function open(path: "/billing/checkout" | "/billing/portal") {
    setError(null);
    setBusy(true);
    try {
      const { url } = await apiFetch<{ url: string }>(path, { method: "POST" });
      window.location.href = url;
    } catch (err) {
      setError(errorText(err, "Could not open billing"));
      setBusy(false);
    }
  }

  if (!billing) {
    return <Card title="Plan">{error ? <Notice kind="error">{error}</Notice> : <p className="text-sm text-muted">Loading…</p>}</Card>;
  }

  const hasPlan = billing.status !== "NONE" && billing.status !== "CANCELED";
  const failing = billing.status === "PAST_DUE" || billing.status === "UNPAID";

  return (
    <Card
      title="Plan"
      description={
        billing.enforced
          ? `${billing.price ? `${formatPrice(billing.price)} per location, billed ${billing.price.interval}ly. ` : "Billed monthly per synced location. "}Adding or removing a location updates your bill automatically.`
          : "Billing is not switched on for this server yet, so everything is included for now."
      }
      action={
        billing.enforced &&
        (billing.appTrial ? (
          billing.checkoutEnabled && (
            <button onClick={() => open("/billing/checkout")} disabled={!isAdmin || busy || billing.syncedLocations === 0} className={PRIMARY_BUTTON}>
              {busy ? "Opening…" : "Add payment method"}
            </button>
          )
        ) : hasPlan ? (
          <button onClick={() => open("/billing/portal")} disabled={!isAdmin || busy} className={SECONDARY_BUTTON}>
            Manage billing
          </button>
        ) : (
          <button
            onClick={() => open("/billing/checkout")}
            disabled={!isAdmin || busy || billing.syncedLocations === 0}
            className={PRIMARY_BUTTON}
            title={billing.syncedLocations === 0 ? "Pick at least one location first" : undefined}
          >
            {busy ? "Opening…" : billing.trialDays > 0 ? `Start ${trialLabel(billing.trialDays)} free trial` : "Choose plan"}
          </button>
        ))
      }
    >
      <div className="space-y-3">
        {error && <Notice kind="error">{error}</Notice>}
        {billing.appTrial && (
          <Notice kind="success">
            Your free trial is active until {formatDate(billing.trialEndsAt)}. No card is needed
            {billing.checkoutEnabled
              ? "; add one any time and you are only charged when the trial ends."
              : ". We will let you know before it ends so you can add payment details."}
          </Notice>
        )}
        {failing && (
          <Notice kind="error">
            Your last payment failed. Syncing and auto-replies pause {billing.graceDays} days after the failed payment. Your data is kept.
            Update your card under Manage billing.
          </Notice>
        )}
        {billing.enforced && (
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Status" value={STATUS_LABEL[billing.status]} />
            {billing.price && billing.status !== "NONE" && (
              <Stat label="Your price" value={formatPrice({ ...billing.price, amount: billing.price.amount * (billing.quantity || billing.syncedLocations) })} />
            )}
            <Stat label="Locations billed" value={`${billing.quantity || billing.syncedLocations}`} />
            <Stat
              label={billing.status === "TRIALING" ? "Trial ends" : billing.cancelAtPeriodEnd ? "Ends on" : "Renews"}
              value={formatDate(billing.status === "TRIALING" ? billing.trialEndsAt : billing.currentPeriodEnd)}
            />
          </dl>
        )}
        <AdminOnlyHint isAdmin={isAdmin} />
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold text-ink">{value}</dd>
    </div>
  );
}

function formatPrice(p: { amount: number; currency: string }): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: p.currency.toUpperCase() }).format(p.amount / 100);
}

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";
}

/** 90 -> "3-month", 14 -> "14-day". */
function trialLabel(days: number): string {
  return days % 30 === 0 ? `${days / 30}-month` : `${days}-day`;
}
