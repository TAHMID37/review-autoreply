"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { PlatformAccount, SyncSummary } from "@/types/api";
import { AdminOnlyHint, Card, errorText, Notice, PRIMARY_BUTTON, SECONDARY_BUTTON } from "./ui";

/** Reads the `?connected=…` params Google's OAuth callback redirects back with. */
function readReturnBanner(): { kind: "success" | "error"; message: string } | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const connected = params.get("connected");
  if (connected === "1") {
    return { kind: "success", message: `Google connected. Found ${params.get("locations") ?? 0} location(s) - tick the ones to sync.` };
  }
  if (connected === "0") {
    return { kind: "error", message: `Could not connect Google: ${params.get("error") ?? "unknown error"}` };
  }
  return null;
}

export function GoogleConnectCard({ returnTo, onChange }: { returnTo: "setup" | "settings"; onChange?: () => void }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [accounts, setAccounts] = useState<PlatformAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null);

  const load = useCallback(() => {
    apiFetch<PlatformAccount[]>("/platform-accounts")
      .then(setAccounts)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    load();
    const returned = readReturnBanner();
    if (returned) {
      setBanner(returned);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [load]);

  async function connect() {
    setError(null);
    setBusy("connect");
    try {
      const { authUrl } = await apiFetch<{ authUrl: string }>(`/platform-accounts/google/connect?return=${returnTo}`);
      window.location.href = authUrl;
    } catch (err) {
      setError(errorText(err, "Could not start Google sign-in"));
      setBusy(null);
    }
  }

  async function run(key: string, action: () => Promise<void>) {
    setError(null);
    setBusy(key);
    try {
      await action();
    } catch (err) {
      setError(errorText(err, "Something went wrong"));
    } finally {
      setBusy(null);
    }
  }

  const connected = (accounts ?? []).filter((a) => a.status !== "DISCONNECTED");

  return (
    <Card
      title="Google Business Profile"
      description="Sign in as the owner or a manager of your Google Business Profile. This lets the app read your reviews and post replies as your business."
      action={
        connected.length === 0 ? (
          <button onClick={connect} disabled={!isAdmin || busy !== null} className={PRIMARY_BUTTON}>
            {busy === "connect" ? "Opening Google…" : "Connect Google"}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() =>
                run("refresh", async () => {
                  await apiFetch("/platform-accounts/refresh-locations", { method: "POST" });
                  onChange?.();
                })
              }
              disabled={busy !== null}
              className={SECONDARY_BUTTON}
              title="Look for locations added to Google since you connected"
            >
              {busy === "refresh" ? "Checking…" : "Find new locations"}
            </button>
            <button
              onClick={() =>
                run("sync", async () => {
                  setSyncSummary(await apiFetch<SyncSummary>("/platform-accounts/sync", { method: "POST" }));
                  onChange?.();
                })
              }
              disabled={busy !== null}
              className={SECONDARY_BUTTON}
            >
              {busy === "sync" ? "Syncing…" : "Sync now"}
            </button>
          </div>
        )
      }
    >
      <div className="space-y-3">
        {banner && <Notice kind={banner.kind}>{banner.message}</Notice>}
        {error && <Notice kind="error">{error}</Notice>}
        {syncSummary && (
          <Notice kind="info">
            {syncSummary.reviewsSeen} review(s) checked: {syncSummary.created} new, {syncSummary.updated} edited,{" "}
            {syncSummary.processed} drafted, {syncSummary.posted} posted, {syncSummary.savedToHubSpot} saved to HubSpot.
          </Notice>
        )}
        {accounts === null && <p className="text-sm text-muted">Loading…</p>}
        {connected.map((account) => (
          <div key={account.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3">
            <p className="flex items-center gap-2 text-sm text-ink">
              <span
                className={`inline-block h-2 w-2 rounded-full ${account.status === "CONNECTED" ? "bg-green-500" : "bg-red-500"}`}
                aria-hidden
              />
              {account.accountEmail} · {account.locationCount} location{account.locationCount === 1 ? "" : "s"}
              {account.status === "ERROR" && <span className="text-red-600">· access expired, reconnect</span>}
            </p>
            {isAdmin && (
              <div className="flex gap-3 text-sm">
                <button onClick={connect} disabled={busy !== null} className="font-medium text-muted hover:underline">
                  Reconnect
                </button>
                <button
                  onClick={() => {
                    if (!window.confirm("Disconnect this Google login? Reviews stop syncing and no replies can be posted.")) return;
                    run("disconnect", async () => {
                      await apiFetch(`/platform-accounts/${account.id}`, { method: "DELETE" });
                      load();
                      onChange?.();
                    });
                  }}
                  disabled={busy !== null}
                  className="font-medium text-red-600 hover:underline"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        ))}
        <AdminOnlyHint isAdmin={isAdmin} />
      </div>
    </Card>
  );
}
