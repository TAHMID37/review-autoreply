"use client";

import { useEffect, useRef, useState } from "react";
import { Card, errorText, Field, FIELD_CLASS, Notice, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/setup/ui";
import { API_URL, apiFetch } from "@/lib/api-client";
import type { Location, Widget, WidgetLayout, WidgetTheme } from "@/types/api";

const LAYOUTS: { value: WidgetLayout; label: string }[] = [
  { value: "CAROUSEL", label: "Carousel" },
  { value: "GRID", label: "Grid" },
  { value: "LIST", label: "List" },
  { value: "BADGE", label: "Badge" },
];

const DEFAULT_THEME: Required<WidgetTheme> = { accent: "#1a73e8", background: "#ffffff", text: "#202124", radius: 12 };

interface Draft {
  name: string;
  layout: WidgetLayout;
  locationIds: string[];
  minRating: number;
  maxReviews: number;
  requireComment: boolean;
  theme: Required<WidgetTheme>;
  domains: string;
}

function toDraft(w?: Widget): Draft {
  return {
    name: w?.name ?? "Website reviews",
    layout: w?.layout ?? "CAROUSEL",
    locationIds: w?.locationIds ?? [],
    minRating: w?.minRating ?? 4,
    maxReviews: w?.maxReviews ?? 12,
    requireComment: w?.requireComment ?? true,
    theme: { ...DEFAULT_THEME, ...(w?.theme ?? {}) },
    domains: (w?.allowedDomains ?? []).join("\n"),
  };
}

/** Review widget: settings, live preview and the embed code to copy. */
export default function WidgetPage() {
  const [widgets, setWidgets] = useState<Widget[] | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(toDraft());
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([apiFetch<Widget[]>("/widgets"), apiFetch<Location[]>("/locations")])
      .then(([w, l]) => {
        setWidgets(w);
        setLocations(l.filter((x) => x.syncEnabled));
        if (w[0]) {
          setSelectedId(w[0].id);
          setDraft(toDraft(w[0]));
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  const selected = widgets?.find((w) => w.id === selectedId) ?? null;

  function select(w: Widget | null) {
    setSelectedId(w?.id ?? null);
    setDraft(toDraft(w ?? undefined));
    setError(null);
  }

  async function save() {
    setError(null);
    setIsSaving(true);
    const payload = {
      name: draft.name.trim(),
      layout: draft.layout,
      locationIds: draft.locationIds,
      minRating: draft.minRating,
      maxReviews: draft.maxReviews,
      requireComment: draft.requireComment,
      theme: draft.theme,
      allowedDomains: draft.domains.split(/[\s,]+/).map((d) => d.trim()).filter(Boolean),
    };
    try {
      const saved = selected
        ? await apiFetch<Widget>(`/widgets/${selected.id}`, { method: "PATCH", body: JSON.stringify(payload) })
        : await apiFetch<Widget>("/widgets", { method: "POST", body: JSON.stringify(payload) });
      setWidgets((prev) => (selected ? (prev ?? []).map((w) => (w.id === saved.id ? saved : w)) : [...(prev ?? []), saved]));
      setSelectedId(saved.id);
      setDraft(toDraft(saved));
      setPreviewKey((k) => k + 1);
    } catch (err) {
      setError(errorText(err, "Could not save the widget"));
    } finally {
      setIsSaving(false);
    }
  }

  async function remove() {
    if (!selected || !window.confirm(`Delete "${selected.name}"? Websites using its code will stop showing reviews.`)) return;
    await apiFetch(`/widgets/${selected.id}`, { method: "DELETE" });
    const rest = (widgets ?? []).filter((w) => w.id !== selected.id);
    setWidgets(rest);
    select(rest[0] ?? null);
  }

  async function copy() {
    if (!selected) return;
    await navigator.clipboard.writeText(selected.snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Review widget</h1>
          <p className="mt-1 text-sm text-muted">
            Show your Google reviews on any website: HubSpot pages, WordPress, Wix, Webflow, Shopify or plain HTML.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {widgets?.map((w) => (
            <button
              key={w.id}
              onClick={() => select(w)}
              className={`rounded-full border px-3 py-1 text-sm ${w.id === selectedId ? "border-brand-pink bg-brand-pink/10 text-brand-pink" : "border-line text-ink"}`}
            >
              {w.name}
            </button>
          ))}
          <button onClick={() => select(null)} className={SECONDARY_BUTTON}>
            + New widget
          </button>
        </div>
      </div>

      {error && <Notice kind="error">{error}</Notice>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <Card title={selected ? "Widget settings" : "New widget"}>
          <div className="space-y-4">
            <Field label="Name" hint="Only you see this.">
              <input value={draft.name} onChange={(e) => set("name", e.target.value)} className={FIELD_CLASS} />
            </Field>

            <Field label="Layout">
              <div className="grid grid-cols-4 gap-1">
                {LAYOUTS.map((l) => (
                  <button
                    key={l.value}
                    type="button"
                    onClick={() => set("layout", l.value)}
                    className={`rounded-md border px-2 py-1.5 text-xs font-medium ${draft.layout === l.value ? "border-brand-pink bg-brand-pink/10 text-brand-pink" : "border-line text-ink"}`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Locations" hint="None ticked = all.">
              <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-line p-2">
                {locations.length === 0 && <p className="text-xs text-muted">Tick locations in Settings first.</p>}
                {locations.map((l) => (
                  <label key={l.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-pink"
                      checked={draft.locationIds.includes(l.id)}
                      onChange={(e) =>
                        set("locationIds", e.target.checked ? [...draft.locationIds, l.id] : draft.locationIds.filter((x) => x !== l.id))
                      }
                    />
                    {l.name}
                  </label>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Lowest rating shown">
                <select value={draft.minRating} onChange={(e) => set("minRating", Number(e.target.value))} className={FIELD_CLASS}>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n}★ and up
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Reviews shown">
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={draft.maxReviews}
                  onChange={(e) => set("maxReviews", Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
                  className={FIELD_CLASS}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-pink"
                checked={draft.requireComment}
                onChange={(e) => set("requireComment", e.target.checked)}
              />
              Only reviews with a written comment
            </label>

            <div className="grid grid-cols-3 gap-3">
              {(["accent", "background", "text"] as const).map((key) => (
                <Field key={key} label={key === "accent" ? "Accent" : key === "background" ? "Card" : "Text"}>
                  <input
                    type="color"
                    value={draft.theme[key]}
                    onChange={(e) => set("theme", { ...draft.theme, [key]: e.target.value })}
                    className="h-9 w-full cursor-pointer rounded-md border border-line"
                  />
                </Field>
              ))}
            </div>
            <Field label="Corner rounding">
              <input
                type="range"
                min={0}
                max={24}
                value={draft.theme.radius}
                onChange={(e) => set("theme", { ...draft.theme, radius: Number(e.target.value) })}
                className="w-full accent-brand-pink"
              />
            </Field>

            <Field label="Allowed websites" hint="One per line. The widget only works on these.">
              <textarea
                value={draft.domains}
                onChange={(e) => set("domains", e.target.value)}
                rows={3}
                placeholder={"yourbusiness.com\n*.yourbusiness.com"}
                className={FIELD_CLASS}
              />
            </Field>

            <div className="flex gap-2">
              <button onClick={save} disabled={isSaving || !draft.name.trim()} className={PRIMARY_BUTTON}>
                {isSaving ? "Saving…" : selected ? "Save changes" : "Create widget"}
              </button>
              {selected && (
                <button onClick={remove} className="text-sm font-medium text-red-600 hover:underline">
                  Delete
                </button>
              )}
            </div>
          </div>
        </Card>

        <div className="min-w-0 space-y-6">
          <Card title="Live preview" description={selected ? "Saved settings, with your real reviews." : "Create the widget to see a preview."}>
            {selected ? <WidgetPreview key={`${selected.publicId}-${previewKey}`} publicId={selected.publicId} /> : null}
          </Card>

          {selected && (
            <Card
              title="Embed code"
              description="Paste this where the reviews should appear. New reviews show up automatically - no need to update the code."
              action={
                <button onClick={copy} className={PRIMARY_BUTTON}>
                  {copied ? "Copied" : "Copy embed code"}
                </button>
              }
            >
              <pre className="overflow-x-auto rounded-lg bg-brand-navy p-3 text-xs leading-relaxed text-white">{selected.snippet}</pre>
              {selected.allowedDomains.length === 0 && (
                <p className="mt-3 text-xs text-amber-700">Add your website under Allowed websites, or the widget will not load there.</p>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

declare global {
  interface Window {
    RAReviews?: { refresh: () => void };
  }
}

/** Mounts the real embed script, exactly as a customer's website would. */
function WidgetPreview({ publicId }: { publicId: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.RAReviews) {
      window.RAReviews.refresh();
      return;
    }
    const script = document.createElement("script");
    script.src = `${API_URL}/widget/embed.js`;
    script.async = true;
    document.body.appendChild(script);
  }, [publicId]);

  return <div ref={ref} className="ra-reviews" data-widget={publicId} />;
}
