"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { Brand } from "@/types/api";
import { errorText, SECONDARY_BUTTON } from "./ui";

/**
 * Shown when HubSpot refused to create our contact properties (usually because
 * the account is at its custom-property limit). Reviews still reach HubSpot as
 * notes, so this explains the gap and how to close it.
 */
export function PropertiesNotice() {
  const { user } = useAuth();
  const [reason, setReason] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "queued">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Brand[]>("/brands")
      .then((brands) => setReason(brands[0]?.hubspotPropertiesBlockedReason ?? null))
      .catch(() => undefined);
  }, []);

  if (!reason) return null;

  async function retry() {
    setError(null);
    setState("busy");
    try {
      await apiFetch("/brands/me/retry-properties", { method: "POST" });
      setState("queued");
    } catch (err) {
      setError(errorText(err, "Could not try again"));
      setState("idle");
    }
  }

  return (
    <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-semibold">Reviews are saved as notes only for now</p>
      <p className="mt-1">
        HubSpot would not let us add the &ldquo;Google reviews&rdquo; fields (rating, comment, date and so on) to your contacts. This usually
        means your HubSpot account has reached its limit of custom contact properties. Each review is still saved as a note on the contact,
        but you cannot filter or build lists on those fields yet.
      </p>
      <p className="mt-2">
        To fix it, delete some custom contact properties you no longer use in HubSpot (Settings, Properties), then try again.
      </p>
      <p className="mt-2 text-xs text-amber-800">HubSpot said: {reason}</p>
      <div className="mt-3 flex items-center gap-3">
        {state === "queued" ? (
          <span className="font-medium">Okay, we will try again on the next sync.</span>
        ) : (
          <button onClick={retry} disabled={user?.role !== "ADMIN" || state === "busy"} className={SECONDARY_BUTTON}>
            {state === "busy" ? "Working…" : "Try again"}
          </button>
        )}
        {error && <span className="text-red-700">{error}</span>}
      </div>
    </div>
  );
}
