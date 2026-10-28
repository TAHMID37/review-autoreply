"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AutoReplyCard } from "@/components/setup/auto-reply-card";
import { GoogleConnectCard } from "@/components/setup/google-connect-card";
import { LocationPicker } from "@/components/setup/location-picker";
import { PlanCard } from "@/components/setup/plan-card";
import { apiFetch } from "@/lib/api-client";
import type { Brand, SetupStatus } from "@/types/api";

/** The guided setup a business sees right after installing from HubSpot. */
export default function SetupPage() {
  const [setup, setSetup] = useState<SetupStatus | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    apiFetch<SetupStatus>("/brands/me/setup").then(setSetup).catch(() => undefined);
    apiFetch<Brand[]>("/brands").then((b) => setBrand(b[0] ?? null)).catch(() => undefined);
  }, []);

  useEffect(reload, [reload, reloadKey]);
  const bump = () => setReloadKey((k) => k + 1);

  const steps = setup?.steps;
  const items: { done: boolean; label: string; optional?: boolean }[] = [
    { done: !!steps?.hubspotConnected, label: "Install in HubSpot" },
    { done: !!steps?.googleConnected, label: "Connect Google" },
    { done: !!steps?.locationsSelected, label: "Pick locations" },
    ...(setup?.billingEnforced ? [{ done: !!steps?.planChosen, label: "Choose a plan" }] : []),
    { done: !!steps?.autoReplyEnabled, label: "Turn on auto-replies", optional: true },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Set up</h1>
        <p className="mt-1 text-sm text-muted">
          A few steps and your Google reviews start syncing every 15 minutes and appearing on your HubSpot contacts.
        </p>
      </div>

      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm">
            <span
              className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-bold ${
                item.done ? "bg-green-600 text-white" : "bg-surface text-muted"
              }`}
            >
              {item.done ? "✓" : i + 1}
            </span>
            <span className={item.done ? "text-muted line-through" : "text-ink"}>{item.label}</span>
            {item.optional && <span className="ml-auto text-xs text-muted">optional</span>}
          </li>
        ))}
      </ol>

      {setup?.complete && (
        <p className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          You&apos;re set up. Reviews will show on the <Link href="/reviews" className="font-semibold underline">Reviews</Link> page
          and on each reviewer&apos;s HubSpot contact. Next, you can add the{" "}
          <Link href="/widget" className="font-semibold underline">review widget</Link> to your website.
        </p>
      )}

      <GoogleConnectCard returnTo="setup" onChange={bump} />
      {steps?.googleConnected && <LocationPicker reloadKey={reloadKey} onSaved={bump} />}
      {setup?.billingEnforced && steps?.locationsSelected && <PlanCard reloadKey={reloadKey} />}
      {brand && steps?.locationsSelected && <AutoReplyCard brand={brand} onChange={(b) => { setBrand(b); bump(); }} />}
    </div>
  );
}
