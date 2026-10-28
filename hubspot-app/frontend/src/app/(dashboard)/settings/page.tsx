"use client";

import { useEffect, useState } from "react";
import { AutoReplyCard } from "@/components/setup/auto-reply-card";
import { GoogleConnectCard } from "@/components/setup/google-connect-card";
import { LocationPicker } from "@/components/setup/location-picker";
import {
  AdminOnlyHint,
  Card,
  errorText,
  Field,
  FIELD_CLASS,
  Notice,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
} from "@/components/setup/ui";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { AuthUser, Brand, NewContactPolicy } from "@/types/api";

export default function SettingsPage() {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    apiFetch<Brand[]>("/brands")
      .then((list) => setBrand(list[0] ?? null))
      .catch((err) => setError(err.message));
  }, []);

  /** Saves part of the business settings and returns the updated record. */
  async function save(patch: Partial<Brand> & { slackWebhookUrl?: string }) {
    if (!brand) return;
    setBrand(await apiFetch<Brand>(`/brands/${brand.id}`, { method: "PATCH", body: JSON.stringify(patch) }));
  }

  if (error) return <Notice kind="error">{error}</Notice>;
  if (!brand) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          For {brand.name}
          {brand.hubspotDomain ? ` (HubSpot account ${brand.hubspotDomain})` : ""}.
        </p>
      </div>

      <BusinessCard brand={brand} onSave={save} />
      <GoogleConnectCard returnTo="settings" onChange={() => setReloadKey((k) => k + 1)} />
      <LocationPicker reloadKey={reloadKey} />
      <AutoReplyCard brand={brand} onChange={setBrand} />
      <HubSpotContactsCard brand={brand} onSave={save} />
      <NotificationsCard brand={brand} onSave={save} />
      <TeamCard />
      <UninstallCard brand={brand} />
    </div>
  );
}

type SaveFn = (patch: Partial<Brand> & { slackWebhookUrl?: string }) => Promise<void>;

/** Wraps a save so each card shows its own saving / saved / error state. */
function useSaver(onSave: SaveFn) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  async function run(patch: Parameters<SaveFn>[0]) {
    setError(null);
    setSaved(false);
    setIsSaving(true);
    try {
      await onSave(patch);
      setSaved(true);
    } catch (err) {
      setError(errorText(err, "Could not save"));
    } finally {
      setIsSaving(false);
    }
  }
  return { run, isSaving, error, saved };
}

function BusinessCard({ brand, onSave }: { brand: Brand; onSave: SaveFn }) {
  const [name, setName] = useState(brand.name);
  const [tone, setTone] = useState(brand.tone);
  const { run, isSaving, error, saved } = useSaver(onSave);
  const changed = name.trim() !== brand.name || tone !== brand.tone;

  return (
    <Card
      title="Business"
      description="Your business name fills ${Business name} in reply templates and signs the replies saved in HubSpot."
    >
      <div className="space-y-4">
        <Field label="Business name">
          <input value={name} onChange={(e) => setName(e.target.value)} className={FIELD_CLASS} />
        </Field>
        <Field label="Reply tone" hint="Used if AI-written replies are switched on.">
          <textarea value={tone} onChange={(e) => setTone(e.target.value)} rows={2} className={FIELD_CLASS} />
        </Field>
        {error && <Notice kind="error">{error}</Notice>}
        {saved && !changed && <Notice kind="success">Saved.</Notice>}
        <button onClick={() => run({ name: name.trim(), tone })} disabled={!changed || isSaving || !name.trim()} className={PRIMARY_BUTTON}>
          {isSaving ? "Saving…" : "Save"}
        </button>
      </div>
    </Card>
  );
}

function HubSpotContactsCard({ brand, onSave }: { brand: Brand; onSave: SaveFn }) {
  const { run, isSaving, error } = useSaver(onSave);

  return (
    <Card
      title="Reviews in HubSpot"
      description="Each Google review is saved as a note on the reviewer's HubSpot contact. We only add notes and new contacts - we never change or delete a contact you already had."
    >
      <div className="space-y-4">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand-pink"
            checked={brand.crmSyncEnabled}
            disabled={isSaving}
            onChange={(e) => run({ crmSyncEnabled: e.target.checked })}
          />
          Save reviews to HubSpot contacts
        </label>

        <fieldset disabled={!brand.crmSyncEnabled || isSaving} className="space-y-2 disabled:opacity-50">
          <legend className="text-sm font-medium text-ink">When no existing contact matches the reviewer</legend>
          {(
            [
              ["ALL_REVIEWERS", "Create a contact for every reviewer (recommended)"],
              ["COMMENTERS_ONLY", "Only create one when the reviewer left a comment"],
            ] as [NewContactPolicy, string][]
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="newContactPolicy"
                className="h-4 w-4 accent-brand-pink"
                checked={brand.newContactPolicy === value}
                onChange={() => run({ newContactPolicy: value })}
              />
              {label}
            </label>
          ))}
        </fieldset>

        <p className="text-xs leading-relaxed text-muted">
          Google only shares the reviewer&apos;s display name, so matching is by name. If more than one contact could be the
          reviewer, we create a new contact and tick <em>Possible duplicate (Google review)</em> on it so you can merge it.
          Contacts we create have <em>Created from: Google Review</em>, so you can filter a list of them.
        </p>
        {error && <Notice kind="error">{error}</Notice>}
      </div>
    </Card>
  );
}

function NotificationsCard({ brand, onSave }: { brand: Brand; onSave: SaveFn }) {
  const [emails, setEmails] = useState(brand.alertEmails.join(", "));
  const [slack, setSlack] = useState("");
  const { run, isSaving, error, saved } = useSaver(onSave);

  const parsed = emails
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter(Boolean);
  const changed = parsed.join(",") !== brand.alertEmails.join(",") || slack.trim() !== "";

  return (
    <Card title="Approval alerts" description="Who hears about a review waiting for a person to approve it.">
      <div className="space-y-4">
        <Field label="Email to" hint="Separate several with commas.">
          <input value={emails} onChange={(e) => setEmails(e.target.value)} className={FIELD_CLASS} placeholder="you@business.com" />
        </Field>
        <Field label="Slack webhook" hint={brand.slackConfigured ? "Set. Paste a new one to replace it." : "Optional."}>
          <input
            value={slack}
            onChange={(e) => setSlack(e.target.value)}
            className={FIELD_CLASS}
            placeholder="https://hooks.slack.com/services/…"
          />
        </Field>
        {error && <Notice kind="error">{error}</Notice>}
        {saved && !changed && <Notice kind="success">Saved.</Notice>}
        <div className="flex gap-2">
          <button
            onClick={async () => {
              await run({ alertEmails: parsed, ...(slack.trim() ? { slackWebhookUrl: slack.trim() } : {}) });
              setSlack("");
            }}
            disabled={!changed || isSaving}
            className={PRIMARY_BUTTON}
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
          {brand.slackConfigured && (
            <button onClick={() => run({ slackWebhookUrl: "" })} disabled={isSaving} className={SECONDARY_BUTTON}>
              Remove Slack
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

function TeamCard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [users, setUsers] = useState<AuthUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<AuthUser[]>("/users")
      .then(setUsers)
      .catch((err) => setError(err.message));
  }, []);

  async function setRole(id: string, role: AuthUser["role"]) {
    setError(null);
    try {
      setUsers(await apiFetch<AuthUser[]>(`/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) }));
    } catch (err) {
      setError(errorText(err, "Could not change the role"));
    }
  }

  return (
    <Card
      title="Team"
      description="Anyone in your HubSpot account can sign in. The person who installed the app is an admin; everyone else starts as staff (can approve replies, can't change billing or consent)."
    >
      {error && <Notice kind="error">{error}</Notice>}
      <ul className="divide-y divide-line rounded-lg border border-line">
        {users?.map((u) => (
          <li key={u.id} className="flex items-center justify-between gap-3 p-3 text-sm">
            <span className="min-w-0 truncate text-ink">
              {u.name} <span className="text-muted">· {u.email}</span>
            </span>
            {isAdmin && u.id !== user?.id ? (
              <select
                value={u.role}
                onChange={(e) => setRole(u.id, e.target.value as AuthUser["role"])}
                className="rounded-md border border-line px-2 py-1 text-sm"
              >
                <option value="ADMIN">Admin</option>
                <option value="STAFF">Staff</option>
              </select>
            ) : (
              <span className="text-xs font-medium text-muted">{u.role === "ADMIN" ? "Admin" : "Staff"}</span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function UninstallCard({ brand }: { brand: Brand }) {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [deleteData, setDeleteData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function uninstall() {
    const warning = deleteData
      ? `Uninstall and permanently delete all of ${brand.name}'s data (reviews, reviewer names, settings)? This cannot be undone.`
      : `Uninstall the app from ${brand.name}'s HubSpot account? Syncing and auto-replies stop and billing is cancelled. Your data is kept in case you reinstall.`;
    if (!window.confirm(warning)) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/hubspot/uninstall", { method: "POST", body: JSON.stringify({ deleteData }) });
      logout();
      window.location.href = "/login";
    } catch (err) {
      setError(errorText(err, "Could not uninstall"));
      setBusy(false);
    }
  }

  return (
    <Card
      title="Uninstall"
      description="Removes the app from your HubSpot account and cancels billing. Notes and contacts already in HubSpot stay there."
    >
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            className="h-4 w-4 accent-red-600"
            checked={deleteData}
            disabled={!isAdmin}
            onChange={(e) => setDeleteData(e.target.checked)}
          />
          Also delete all our data for this business
        </label>
        {error && <Notice kind="error">{error}</Notice>}
        <button
          onClick={uninstall}
          disabled={!isAdmin || busy}
          className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          {busy ? "Uninstalling…" : "Uninstall app"}
        </button>
        <AdminOnlyHint isAdmin={isAdmin} />
      </div>
    </Card>
  );
}
