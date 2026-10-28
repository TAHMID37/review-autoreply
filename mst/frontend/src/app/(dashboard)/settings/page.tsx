"use client";

import { useCallback, useEffect, useState } from "react";
import type { Brand, LoginResponse, PlatformAccount, SyncSummary } from "@/types/api";
import { apiFetch } from "@/lib/api-client";
import { APP_BRAND } from "@/lib/app-brand";
import { useAuth } from "@/lib/auth-context";

export default function SettingsPage() {
  const [brands, setBrands] = useState<Brand[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Brand[]>("/brands")
      .then(setBrands)
      .catch((err) => setError(err.message));
  }, []);

  async function saveTone(brand: Brand, tone: string) {
    const updated = await apiFetch<Brand>(`/brands/${brand.id}`, {
      method: "PATCH",
      body: JSON.stringify({ tone }),
    });
    setBrands((prev) => prev?.map((b) => (b.id === updated.id ? updated : b)) ?? null);
  }

  return (
    <div className="space-y-8">
      <AccountSection />

      <GoogleConnectionSection brands={brands} />

      <div>
        <h1 className="text-lg font-semibold text-ink">Brand tone & rules</h1>
        <p className="mt-1 text-sm text-muted">
          This is the instruction the AI reads before drafting a reply for each brand.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {brands?.map((brand) => (
        <BrandToneEditor key={brand.id} brand={brand} onSave={(tone) => saveTone(brand, tone)} />
      ))}
    </div>
  );
}

// ── Your own login ────────────────────────────────────────────────────────────

/**
 * Lets whoever is signed in change their own name, email and password without
 * anyone touching the server. Each dashboard has its own separate login, so a
 * change here only affects this brand's site.
 */
function AccountSection() {
  const { user, applySession } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  // Fill the form once the signed-in user has loaded.
  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setEmail(user.email);
  }, [user]);

  const detailsChanged = user !== null && (name.trim() !== user.name || email.trim() !== user.email);
  const hasChanges = detailsChanged || newPassword.length > 0;

  async function handleSave() {
    setError(null);
    setSaved(null);

    if (newPassword && newPassword !== confirmPassword) {
      setError("The two new passwords do not match.");
      return;
    }
    if (newPassword && newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    setIsSaving(true);
    try {
      const session = await apiFetch<LoginResponse>("/auth/account", {
        method: "PATCH",
        body: JSON.stringify({
          currentPassword,
          name: name.trim(),
          email: email.trim(),
          ...(newPassword ? { newPassword } : {}),
        }),
      });
      applySession(session);
      setNewPassword("");
      setConfirmPassword("");
      setCurrentPassword("");
      setSaved(
        newPassword
          ? "Saved. Use your new password the next time you sign in."
          : "Saved.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your changes");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-ink">Your login</h1>
      <p className="mt-1 text-sm text-muted">
        The email and password you use to sign in here. This is the {APP_BRAND.displayName} dashboard
        only &mdash; the other brand&apos;s dashboard has its own separate login.
      </p>

      <div className="mt-3 rounded-lg border border-line bg-white p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className={FIELD_CLASS}
            />
          </Field>
          <Field label="Email address" hint="This is also your username.">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              className={FIELD_CLASS}
            />
          </Field>
          <Field label="New password" hint="Leave blank to keep your current one.">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className={FIELD_CLASS}
            />
          </Field>
          <Field label="Confirm new password">
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              disabled={newPassword.length === 0}
              className={`${FIELD_CLASS} disabled:bg-gray-50`}
            />
          </Field>
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <Field label="Current password" hint="Required to save any change above.">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              className={`${FIELD_CLASS} sm:w-1/2`}
            />
          </Field>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {saved && <p className="mt-3 text-sm text-green-700">{saved}</p>}

        <button
          onClick={handleSave}
          disabled={isSaving || !hasChanges || currentPassword.length === 0}
          className="mt-4 rounded-md bg-brand-pink px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {isSaving ? "Saving\u2026" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

const FIELD_CLASS =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      {hint && <span className="ml-1 text-xs text-muted">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}


// ── Google Business Profile connection ────────────────────────────────────────

/** Reads the `?connected=…` params the OAuth callback redirects back with. */
function readReturnBanner(): { kind: "success" | "error"; message: string } | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const connected = params.get("connected");
  if (connected === "1") {
    const locations = params.get("locations");
    return {
      kind: "success",
      message: `Google account connected. ${locations ?? 0} location(s) linked.`,
    };
  }
  if (connected === "0") {
    return {
      kind: "error",
      message: `Could not connect Google: ${params.get("error") ?? "unknown error"}`,
    };
  }
  return null;
}

function GoogleConnectionSection({ brands }: { brands: Brand[] | null }) {
  const [accounts, setAccounts] = useState<PlatformAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectingBrandId, setConnectingBrandId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null);

  const loadAccounts = useCallback(() => {
    apiFetch<PlatformAccount[]>("/platform-accounts")
      .then(setAccounts)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    loadAccounts();

    // Surface the outcome of a just-completed OAuth round-trip, then strip the
    // query params so a refresh does not re-show the banner.
    const returned = readReturnBanner();
    if (returned) {
      setBanner(returned);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [loadAccounts]);

  async function connect(brandId: string) {
    setError(null);
    setConnectingBrandId(brandId);
    try {
      const { authUrl } = await apiFetch<{ authUrl: string }>(
        `/platform-accounts/google/connect?brandId=${encodeURIComponent(brandId)}`,
      );
      // Full-page redirect: the callback returns the browser to /settings with
      // the ?connected=… result, which the banner above picks up.
      window.location.href = authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Google connect");
      setConnectingBrandId(null);
    }
  }

  async function syncNow() {
    setError(null);
    setIsSyncing(true);
    setSyncSummary(null);
    try {
      const summary = await apiFetch<SyncSummary>("/platform-accounts/sync", { method: "POST" });
      setSyncSummary(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setIsSyncing(false);
    }
  }

  // A brand is "connected" when a Google account actually covers its campuses -
  // not by which brand the account was filed under. One agency login can cover
  // several brands, so coverage is derived from the linked campuses.
  const coverageByBrand = new Map<string, { accountEmail: string; status: PlatformAccount["status"]; locationCount: number }>();
  for (const account of accounts ?? []) {
    for (const c of account.coverage) {
      const prev = coverageByBrand.get(c.brandId);
      coverageByBrand.set(c.brandId, {
        accountEmail: account.accountEmail,
        status: account.status,
        locationCount: (prev?.locationCount ?? 0) + c.locationCount,
      });
    }
  }
  const hasAnyConnection = (accounts?.length ?? 0) > 0;

  return (
    <section>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-ink">Google Business Profile</h1>
          <p className="mt-1 text-sm text-muted">
            Connect each brand&apos;s Google account to pull in reviews. Read-only: nothing is posted
            back to Google.
          </p>
        </div>
        <button
          onClick={syncNow}
          disabled={isSyncing || !hasAnyConnection}
          className="shrink-0 rounded-md border border-line bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface disabled:opacity-50"
          title={hasAnyConnection ? "Pull the latest reviews now" : "Connect an account first"}
        >
          {isSyncing ? "Syncing…" : "Sync now"}
        </button>
      </div>

      {banner && (
        <p
          className={`mt-3 rounded-md border p-3 text-sm ${
            banner.kind === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {banner.message}
        </p>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {syncSummary && (
        <p className="mt-3 rounded-md border border-line bg-surface p-3 text-sm text-ink">
          Synced {syncSummary.accountsSynced} account(s): {syncSummary.reviewsSeen} review(s) seen,{" "}
          {syncSummary.created} new, {syncSummary.updated} edited, {syncSummary.processed} drafted
          {syncSummary.failed > 0 ? `, ${syncSummary.failed} failed` : ""}.
        </p>
      )}

      <div className="mt-4 space-y-3">
        {brands === null && <p className="text-sm text-muted">Loading brands…</p>}
        {brands?.map((brand) => {
          const cov = coverageByBrand.get(brand.id);
          return (
            <div
              key={brand.id}
              className="flex items-center justify-between rounded-lg border border-line bg-white p-4"
            >
              <div>
                <h2 className="font-medium text-ink">{brand.name}</h2>
                {cov ? (
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                    <StatusDot status={cov.status} />
                    <span>
                      Connected via {cov.accountEmail} · {cov.locationCount}{" "}
                      {cov.locationCount === 1 ? "campus" : "campuses"}
                    </span>
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted">Not connected.</p>
                )}
              </div>
              {cov ? (
                <button
                  onClick={() => connect(brand.id)}
                  disabled={connectingBrandId !== null}
                  className="shrink-0 text-sm font-medium text-muted underline-offset-2 hover:underline disabled:opacity-50"
                  title="Re-run Google sign-in for this account (safe - updates the existing connection, no duplicate)"
                >
                  {connectingBrandId === brand.id ? "Redirecting…" : "Reconnect"}
                </button>
              ) : (
                <button
                  onClick={() => connect(brand.id)}
                  disabled={connectingBrandId !== null}
                  className="shrink-0 rounded-md bg-brand-pink px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {connectingBrandId === brand.id ? "Redirecting…" : "Connect Google"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StatusDot({ status }: { status: PlatformAccount["status"] }) {
  const color =
    status === "CONNECTED" ? "bg-green-500" : status === "ERROR" ? "bg-red-500" : "bg-gray-400";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} aria-hidden />;
}

// ── Brand tone editor ─────────────────────────────────────────────────────────

function BrandToneEditor({ brand, onSave }: { brand: Brand; onSave: (tone: string) => Promise<void> }) {
  const [tone, setTone] = useState(brand.tone);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    try {
      await onSave(tone);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <h2 className="font-medium text-ink">{brand.name}</h2>
      <textarea
        value={tone}
        onChange={(e) => setTone(e.target.value)}
        rows={3}
        className="mt-2 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink"
      />
      <button
        onClick={handleSave}
        disabled={isSaving || tone === brand.tone}
        className="mt-2 rounded-md bg-brand-pink px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {isSaving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
