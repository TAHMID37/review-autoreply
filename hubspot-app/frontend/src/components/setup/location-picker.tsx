"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { Location } from "@/types/api";
import { AdminOnlyHint, Card, errorText, Notice, PRIMARY_BUTTON } from "./ui";

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

  async function save() {
    setError(null);
    setIsSaving(true);
    try {
      const list = await apiFetch<Location[]>("/locations/selection", {
        method: "PUT",
        body: JSON.stringify({ locationIds: [...selected] }),
      });
      setLocations(list);
      setSaved(true);
      onSaved?.();
    } catch (err) {
      setError(errorText(err, "Could not save your locations"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card
      title="Locations"
      description="Tick the locations to manage. Only ticked locations are synced, and billing is per ticked location."
      action={
        <button onClick={save} disabled={!isAdmin || !changed || isSaving} className={PRIMARY_BUTTON}>
          {isSaving ? "Saving…" : `Save (${selected.size} selected)`}
        </button>
      }
    >
      <div className="space-y-3">
        {error && <Notice kind="error">{error}</Notice>}
        {saved && !changed && <Notice kind="success">Saved. Ticked locations sync on the next run (or press Sync now).</Notice>}
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
