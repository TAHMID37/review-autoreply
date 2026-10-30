"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { Brand } from "@/types/api";
import { AdminOnlyHint, Card, errorText, Notice, PRIMARY_BUTTON, SECONDARY_BUTTON } from "./ui";

/**
 * Auto-replies are off until an admin switches them on and ticks the consent
 * box (Google requires the business's consent). Only reviews left after that
 * moment are auto-replied.
 */
export function AutoReplyCard({ brand, onChange }: { brand: Brand; onChange: (b: Brand) => void }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [consent, setConsent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function set(enabled: boolean) {
    setError(null);
    setIsSaving(true);
    try {
      onChange(
        await apiFetch<Brand>("/brands/me/auto-reply", {
          method: "PUT",
          body: JSON.stringify({ enabled, consent: enabled ? consent : undefined }),
        }),
      );
      setConsent(false);
    } catch (err) {
      setError(errorText(err, "Could not change auto-replies"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card
      title="Auto-replies"
      description={
        brand.autoReplyEnabled
          ? `On since ${new Date(brand.autoReplyStartAt ?? brand.autoReplyConsentAt ?? "").toLocaleString()}. New reviews are replied to after each rule's delay.`
          : "Off. Replies are drafted for you to review, but nothing is posted automatically."
      }
      action={
        brand.autoReplyEnabled ? (
          <button onClick={() => set(false)} disabled={!isAdmin || isSaving} className={SECONDARY_BUTTON}>
            {isSaving ? "Saving…" : "Turn off"}
          </button>
        ) : undefined
      }
    >
      <div className="space-y-3">
        {error && <Notice kind="error">{error}</Notice>}
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Replies use your templates and rules: 4 hours after 1–2★ reviews without a comment, 24 hours after 3–5★.</li>
          <li>1–2★ reviews with a comment, and reviews raising a sensitive topic, always wait in Alerts for a person.</li>
          <li>Only reviews left after you switch this on are replied to. Your existing reviews are left alone.</li>
        </ul>
        {!brand.autoReplyEnabled && (
          <>
            <label className="flex items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-brand-pink"
                checked={consent}
                disabled={!isAdmin}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                I agree to let this app post replies to Google reviews on behalf of <strong>{brand.name}</strong>, using the
                templates and rules set up here.
              </span>
            </label>
            <button onClick={() => set(true)} disabled={!isAdmin || !consent || isSaving} className={PRIMARY_BUTTON}>
              {isSaving ? "Saving…" : "Turn on auto-replies"}
            </button>
          </>
        )}
        <AdminOnlyHint isAdmin={isAdmin} />
      </div>
    </Card>
  );
}
