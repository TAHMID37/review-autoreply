"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useSyncProgress } from "@/lib/use-sync-progress";
import { useAuth } from "@/lib/auth-context";
import type { Location } from "@/types/api";
import { AdminOnlyHint, Card, errorText, Notice, PRIMARY_BUTTON, SECONDARY_BUTTON } from "./ui";
import { SyncProgressBar } from "./sync-progress-bar";

/**
 * Only ticked locations are synced (and billed). Unticking keeps a
 * location's reviews but stops syncing it.
 */
export function LocationPicker({ reloadKey = 0, onSaved }: { reloadKey?: number; onSaved?: () => void }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [locations, setLocations] = useState<Location[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const sync = useSyncProgress();

  // Refresh the stored-review counts and the setup checklist when a sync ends.
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  useEffect(() => {
    if (sync.justFinished) onSavedRef.current?.();
  }, [sync.justFinished]);

  useEffect(() => {
    apiFetch<Location[]>("/locations")
      .then((list) => {
        setLocations(list);
        setSelected(new Set(list.filter((l) => l.syncEnabled).map((l) => l.id)));
      })
      .catch((err) => setError(err.message));
  }, [reloadKey]);

  const original = new Set((locations ?? []).filter((l) => l.syncEnabled).map((l) => l.id));
  const changed = selected.size !== original.size || [...selected].some((id) => !original.has(id));

  function toggle(id: string) {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Saves the ticked locations and, in the same click, syncs them. */
  async function save(thenSync: boolean) {
    setError(null);
    setIsSaving(true);
    try {
      if (changed) {
        const list = await apiFetch<Location[]>("/locations/selection", {
          method: "PUT",
          body: JSON.stringify({ locationIds: [...selected] }),
        });
        setLocations(list);
        setSaved(true);
        onSaved?.();
      }
      if (thenSync) await sync.start();
    } catch (err) {
      setError(errorText(err, "Could not save your locations"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card
      title="Locations"
      description="Tick the locations to manage, then press Save and sync. Only ticked locations are synced, and billing is per ticked location. These are the locations of the Google account connected above."
      action={
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => save(true)}
            disabled={!isAdmin || selected.size === 0 || isSaving || sync.running}
            className={PRIMARY_BUTTON}
            title="Saves your ticked locations and starts reading their reviews"
          >
            {isSaving ? "Saving…" : sync.running ? "Syncing…" : changed ? `Save and sync (${selected.size})` : `Sync now (${selected.size})`}
          </button>
          {changed && (
            <button onClick={() => save(false)} disabled={!isAdmin || isSaving || sync.running} className={SECONDARY_BUTTON}>
              Save only
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-3">
        {error && <Notice kind="error">{error}</Notice>}
        {sync.error && <Notice kind="error">{sync.error}</Notice>}
        {sync.running && sync.progress && <SyncProgressBar progress={sync.progress} />}
        {!sync.running && sync.progress?.state === "error" && sync.justFinished && (
          <Notice kind="error">Sync stopped: {sync.progress.error}</Notice>
        )}
        {!sync.running && sync.progress?.state === "done" && sync.progress.summary && sync.justFinished && (
          <Notice kind="success">
            Sync finished. {sync.progress.summary.reviewsSeen} review(s) checked: {sync.progress.summary.created} new,{" "}
            {sync.progress.summary.processed} drafted, {sync.progress.summary.posted} posted,{" "}
            {sync.progress.summary.savedToHubSpot} saved to HubSpot.
          </Notice>
        )}
        {saved && !changed && !sync.running && !sync.justFinished && (
          <Notice kind="success">Saved. Press Sync now to read their reviews, or wait for the next automatic run.</Notice>
        )}
        {locations?.length === 0 && <p className="text-sm text-muted">No locations yet. Connect Google first.</p>}
        <ul className="divide-y divide-line rounded-lg border border-line">
          {locations?.map((l) => (
            <li key={l.id}>
              <label className="flex cursor-pointer items-start gap-3 p-3 hover:bg-surface">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-brand-pink"
                  checked={selected.has(l.id)}
                  disabled={!isAdmin}
                  onChange={() => toggle(l.id)}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">{l.name}</span>
                  <span className="block text-xs text-muted">
                    {l.address ?? "No address on Google"}
                    {l._count ? ` · ${l._count.reviews} review${l._count.reviews === 1 ? "" : "s"} stored` : ""}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <AdminOnlyHint isAdmin={isAdmin} />
      </div>
    </Card>
  );
}
