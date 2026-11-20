"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { errorText, Notice, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/setup/ui";
import { API_URL, apiFetch } from "@/lib/api-client";
import type { Location, Review, Widget, WidgetLayout, WidgetTheme } from "@/types/api";

const LAYOUTS: { value: WidgetLayout; label: string; hint: string }[] = [
  { value: "CAROUSEL", label: "Carousel", hint: "Slides sideways" },
  { value: "GRID", label: "Grid", hint: "Cards in rows" },
  { value: "LIST", label: "List", hint: "One under another" },
  { value: "BADGE", label: "Badge", hint: "Rating only" },
];

/** Bump when embed.js gains something the preview needs, so cached copies are skipped. */
const EMBED_SCRIPT_VERSION = 2;

const DEFAULT_THEME: Required<WidgetTheme> = { accent: "#1a73e8", background: "#ffffff", text: "#202124", radius: 12 };

/** Ready-made colour sets, so a good look is one click. */
const THEME_PRESETS: { name: string; theme: Required<WidgetTheme> }[] = [
  { name: "Light", theme: { accent: "#1a73e8", background: "#ffffff", text: "#202124", radius: 12 } },
  { name: "Warm", theme: { accent: "#d1035a", background: "#fff7f9", text: "#3b1020", radius: 16 } },
  { name: "Dark", theme: { accent: "#8ab4f8", background: "#202124", text: "#e8eaed", radius: 12 } },
  { name: "Sharp", theme: { accent: "#188038", background: "#ffffff", text: "#202124", radius: 2 } },
];

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

const sameDraft = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b);

/** Review widget: every choice shows in the preview straight away; Save makes it live. */
export default function WidgetPage() {
  const [widgets, setWidgets] = useState<Widget[] | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(toDraft());
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  // Bumped when a review is hidden or shown, so the preview redraws.
  const [reviewsVersion, setReviewsVersion] = useState(0);

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
  const saved = useMemo(() => toDraft(selected ?? undefined), [selected]);
  const hasChanges = !sameDraft(draft, saved);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setJustSaved(false);
    setDraft((d) => ({ ...d, [key]: value }));
  };

  function select(w: Widget | null) {
    if (hasChanges && !window.confirm("You have unsaved changes. Switch anyway?")) return;
    setSelectedId(w?.id ?? null);
    setDraft(toDraft(w ?? undefined));
    setError(null);
    setJustSaved(false);
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
      const result = selected
        ? await apiFetch<Widget>(`/widgets/${selected.id}`, { method: "PATCH", body: JSON.stringify(payload) })
        : await apiFetch<Widget>("/widgets", { method: "POST", body: JSON.stringify(payload) });
      setWidgets((prev) => (selected ? (prev ?? []).map((w) => (w.id === result.id ? result : w)) : [...(prev ?? []), result]));
      setSelectedId(result.id);
      setDraft(toDraft(result));
      setJustSaved(true);
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
    setSelectedId(rest[0]?.id ?? null);
    setDraft(toDraft(rest[0]));
  }

  async function copy() {
    if (!selected) return;
    await navigator.clipboard.writeText(selected.snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const allSelected = locations.length > 0 && draft.locationIds.length === 0;

  return (
    <div className="space-y-5 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Review widget</h1>
          <p className="mt-1 text-sm text-muted">
            Show your Google reviews on any website. Change anything on the left and the preview updates straight away.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {widgets?.map((w) => (
            <button
              key={w.id}
              onClick={() => select(w)}
              className={`rounded-full border px-3 py-1 text-sm transition ${
                w.id === selectedId ? "border-brand-pink bg-brand-pink/10 font-medium text-brand-pink" : "border-line bg-white text-ink hover:bg-surface"
              }`}
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

      <div className="grid gap-5 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        {/* ───── Settings ───── */}
        <div className="space-y-4">
          <Panel step={1} title="What to show">
            <div className="space-y-4">
              <Labelled label="Widget name" hint="Only you see this">
                <input
                  value={draft.name}
                  onChange={(e) => set("name", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink"
                />
              </Labelled>

              <Labelled label="Layout">
                <div className="grid grid-cols-2 gap-2">
                  {LAYOUTS.map((l) => (
                    <button
                      key={l.value}
                      type="button"
                      onClick={() => set("layout", l.value)}
                      aria-pressed={draft.layout === l.value}
                      className={`flex items-center gap-3 rounded-lg border p-2.5 text-left transition ${
                        draft.layout === l.value ? "border-brand-pink bg-brand-pink/5 ring-1 ring-brand-pink" : "border-line bg-white hover:bg-surface"
                      }`}
                    >
                      <LayoutIcon layout={l.value} active={draft.layout === l.value} />
                      <span>
                        <span className="block text-sm font-medium text-ink">{l.label}</span>
                        <span className="block text-xs text-muted">{l.hint}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </Labelled>

              <Labelled
                label="Locations"
                hint={allSelected ? "All locations" : `${draft.locationIds.length} of ${locations.length} picked`}
              >
                {locations.length === 0 ? (
                  <p className="rounded-md border border-dashed border-line p-3 text-xs text-muted">
                    Tick locations in Settings first, then they appear here.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2 text-xs">
                      <button type="button" onClick={() => set("locationIds", [])} className="font-medium text-brand-pink hover:underline">
                        All locations
                      </button>
                      <span className="text-muted">·</span>
                      <button
                        type="button"
                        onClick={() => set("locationIds", locations.map((l) => l.id))}
                        className="font-medium text-brand-pink hover:underline"
                      >
                        Pick each one
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {locations.map((l) => {
                        const on = allSelected || draft.locationIds.includes(l.id);
                        return (
                          <button
                            key={l.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() => {
                              // Starting from "all", a click means "just this one" rather than "everything except it".
                              const current = allSelected ? locations.map((x) => x.id) : draft.locationIds;
                              const next = on ? current.filter((x) => x !== l.id) : [...current, l.id];
                              set("locationIds", next.length === locations.length ? [] : next);
                            }}
                            className={`rounded-full border px-3 py-1 text-xs transition ${
                              on ? "border-brand-pink bg-brand-pink/10 font-medium text-brand-pink" : "border-line bg-white text-muted hover:bg-surface"
                            }`}
                          >
                            {on && "✓ "}
                            {l.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Labelled>

              <Labelled label="Lowest rating shown">
                <div className="flex gap-1">
                  {[5, 4, 3, 2, 1].map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={draft.minRating === n}
                      onClick={() => set("minRating", n)}
                      className={`flex-1 rounded-md border px-2 py-1.5 text-sm transition ${
                        draft.minRating === n ? "border-brand-pink bg-brand-pink/10 font-medium text-brand-pink" : "border-line bg-white text-ink hover:bg-surface"
                      }`}
                    >
                      {n}★{n < 5 ? "+" : ""}
                    </button>
                  ))}
                </div>
              </Labelled>

              <Labelled label="How many reviews" hint={`${draft.maxReviews}`}>
                <input
                  type="range"
                  min={1}
                  max={50}
                  value={draft.maxReviews}
                  onChange={(e) => set("maxReviews", Number(e.target.value))}
                  className="w-full accent-brand-pink"
                />
              </Labelled>

              <Toggle
                checked={draft.requireComment}
                onChange={(v) => set("requireComment", v)}
                label="Only reviews with a written comment"
              />
            </div>
          </Panel>

          <Panel step={2} title="How it looks">
            <div className="space-y-4">
              <Labelled label="Style">
                <div className="grid grid-cols-4 gap-2">
                  {THEME_PRESETS.map((p) => {
                    const active = JSON.stringify(p.theme) === JSON.stringify(draft.theme);
                    return (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => set("theme", p.theme)}
                        aria-pressed={active}
                        className={`rounded-lg border p-1.5 text-center text-xs transition ${
                          active ? "border-brand-pink ring-1 ring-brand-pink" : "border-line hover:bg-surface"
                        }`}
                      >
                        <span
                          className="mb-1 block h-8 rounded-md border border-black/10"
                          style={{ background: p.theme.background, borderRadius: Math.min(p.theme.radius, 10) }}
                        >
                          <span className="mx-auto mt-3 block h-1.5 w-6 rounded-full" style={{ background: p.theme.accent }} />
                        </span>
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              </Labelled>

              <div className="grid grid-cols-3 gap-3">
                {(["accent", "background", "text"] as const).map((key) => (
                  <Labelled key={key} label={key === "accent" ? "Accent" : key === "background" ? "Card" : "Text"}>
                    <input
                      type="color"
                      value={draft.theme[key]}
                      onChange={(e) => set("theme", { ...draft.theme, [key]: e.target.value })}
                      className="h-9 w-full cursor-pointer rounded-md border border-line"
                    />
                  </Labelled>
                ))}
              </div>

              <Labelled label="Corner rounding" hint={`${draft.theme.radius}px`}>
                <input
                  type="range"
                  min={0}
                  max={24}
                  value={draft.theme.radius}
                  onChange={(e) => set("theme", { ...draft.theme, radius: Number(e.target.value) })}
                  className="w-full accent-brand-pink"
                />
              </Labelled>
            </div>
          </Panel>

          <Panel step={3} title="Pick which reviews to show">
            <ReviewPicker draft={draft} onChange={() => setReviewsVersion((v) => v + 1)} />
          </Panel>

          <Panel step={4} title="Where it will appear">
            <Labelled label="Allowed websites" hint="One per line">
              <textarea
                value={draft.domains}
                onChange={(e) => set("domains", e.target.value)}
                rows={3}
                placeholder={"yourbusiness.com\n*.yourbusiness.com"}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink"
              />
            </Labelled>
            <p className="mt-2 text-xs text-muted">The widget only loads on these websites, so nobody else can use your code.</p>
          </Panel>
        </div>

        {/* ───── Preview + code ───── */}
        <div className="min-w-0 space-y-5 lg:sticky lg:top-4 lg:self-start">
          <LivePreview draft={draft} locationsReady={locations.length > 0} refreshKey={reviewsVersion} />

          {selected ? (
            <section className="rounded-xl border border-line bg-white p-5 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-ink">Embed code</h2>
                  <p className="mt-1 text-sm text-muted">
                    Paste it where the reviews should appear. New reviews show up on their own, so you never need to change it.
                  </p>
                </div>
                <button onClick={copy} className={PRIMARY_BUTTON}>
                  {copied ? "Copied ✓" : "Copy embed code"}
                </button>
              </div>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-brand-navy p-3 text-xs leading-relaxed text-white">{selected.snippet}</pre>
              {selected.allowedDomains.length === 0 && (
                <p className="mt-3 text-xs text-amber-700">Add your website under Allowed websites and save, or the widget will not load there.</p>
              )}
            </section>
          ) : (
            <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">
              Happy with the preview? Click <strong>Create widget</strong> below to get your embed code.
            </p>
          )}
        </div>
      </div>

      {/* ───── Save bar ───── */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-white/95 backdrop-blur lg:left-60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <p className="text-sm text-muted" aria-live="polite">
            {isSaving ? "Saving…" : hasChanges ? "You have unsaved changes. The preview shows them, your website does not yet." : justSaved ? "Saved ✓ Your website now shows this." : selected ? "All changes saved." : "Not created yet."}
          </p>
          <div className="ml-auto flex items-center gap-2">
            {selected && (
              <button onClick={remove} className="mr-2 text-sm font-medium text-red-600 hover:underline">
                Delete widget
              </button>
            )}
            {hasChanges && selected && (
              <button onClick={() => setDraft(saved)} className={SECONDARY_BUTTON}>
                Undo changes
              </button>
            )}
            <button onClick={save} disabled={isSaving || !draft.name.trim() || (!!selected && !hasChanges)} className={PRIMARY_BUTTON}>
              {isSaving ? "Saving…" : selected ? "Save changes" : "Create widget"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Panel({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-5 shadow-card">
      <h2 className="mb-4 flex items-center gap-2 font-semibold text-ink">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-navy text-xs font-bold text-white">{step}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Labelled({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-ink">{label}</span>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-white p-2.5 text-left hover:bg-surface"
    >
      <span className="text-sm text-ink">{label}</span>
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? "bg-brand-pink" : "bg-gray-300"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

/** Tiny drawing of each layout, so the choice is visible before it is made. */
function LayoutIcon({ layout, active }: { layout: WidgetLayout; active: boolean }) {
  const fill = active ? "#D1035A" : "#9ca3af";
  const card = (x: number, y: number, w: number, h: number) => <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx={2} fill={fill} opacity={0.85} />;
  return (
    <svg viewBox="0 0 36 28" className="h-8 w-10 shrink-0" aria-hidden="true">
      {layout === "CAROUSEL" && [card(2, 6, 12, 16), card(16, 6, 12, 16), card(30, 6, 6, 16)]}
      {layout === "GRID" && [card(2, 3, 15, 10), card(19, 3, 15, 10), card(2, 15, 15, 10), card(19, 15, 15, 10)]}
      {layout === "LIST" && [card(2, 3, 32, 6), card(2, 11, 32, 6), card(2, 19, 32, 6)]}
      {layout === "BADGE" && card(6, 9, 24, 10)}
    </svg>
  );
}

declare global {
  interface Window {
    RAReviews?: { refresh: () => void; render?: (el: HTMLElement, feed: unknown) => void };
  }
}

type PreviewWidth = "desktop" | "mobile";

/** True for a light colour (#RRGGBB), by perceived brightness. */
function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

/**
 * Shows the widget exactly as a website would, using the real embed script,
 * but fed from the unsaved draft - so each click is visible immediately.
 */
function LivePreview({ draft, locationsReady, refreshKey }: { draft: Draft; locationsReady: boolean; refreshKey: number }) {
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<PreviewWidth>("desktop");
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  const body = useMemo(
    () => ({
      layout: draft.layout,
      locationIds: draft.locationIds,
      minRating: draft.minRating,
      maxReviews: draft.maxReviews,
      requireComment: draft.requireComment,
      theme: draft.theme,
    }),
    [draft.layout, draft.locationIds, draft.minRating, draft.maxReviews, draft.requireComment, draft.theme],
  );
  const key = JSON.stringify(body);
  const redraw = `${key}|${refreshKey}`;

  const ensureScript = useCallback(
    () =>
      new Promise<void>((resolve, reject) => {
        if (window.RAReviews?.render) return resolve();
        // An older copy of the script (cached in the browser, or loaded by an earlier
        // version of this page) has no render(). Replace it with a versioned URL so
        // the browser fetches the current one.
        document.querySelectorAll("script[data-ra-embed], script[src*='/widget/embed.js']").forEach((el) => el.remove());
        const script = document.createElement("script");
        script.src = `${API_URL}/widget/embed.js?v=${EMBED_SCRIPT_VERSION}`;
        script.async = true;
        script.setAttribute("data-ra-embed", "1");
        script.addEventListener("load", () =>
          window.RAReviews?.render ? resolve() : reject(new Error("The widget script is out of date. Refresh the page (Cmd+Shift+R).")),
        );
        script.addEventListener("error", () => reject(new Error("Could not load the widget script")));
        document.body.appendChild(script);
      }),
    [],
  );

  // Waits a moment after the last click, then redraws.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const [feed] = await Promise.all([apiFetch<{ reviews: unknown[] }>("/widgets/preview", { method: "POST", body: key }), ensureScript()]);
        if (cancelled || !host.current) return;
        window.RAReviews!.render!(host.current, feed);
        setMessage(null);
        setStatus(feed.reviews.length === 0 && draft.layout !== "BADGE" ? "empty" : "ready");
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setMessage(errorText(err, "Could not load the preview"));
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [redraw, key, ensureScript, draft.layout]);

  return (
    <section className="rounded-xl border border-line bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-ink">Live preview</h2>
          <p className="mt-1 text-sm text-muted">Your real reviews, drawn the way your website will show them.</p>
        </div>
        <div role="group" aria-label="Preview size" className="flex overflow-hidden rounded-md border border-line text-sm">
          {(["desktop", "mobile"] as const).map((w) => (
            <button
              key={w}
              onClick={() => setWidth(w)}
              aria-pressed={width === w}
              className={`px-3 py-1 ${width === w ? "bg-brand-navy text-white" : "bg-white text-ink hover:bg-surface"}`}
            >
              {w === "desktop" ? "Desktop" : "Phone"}
            </button>
          ))}
        </div>
      </div>

      {/* Light text means the website behind it is dark, so the backdrop follows. */}
      <div className="mt-4 rounded-lg p-4" style={{ background: isLight(draft.theme.text) ? "#0f1115" : "#f4f5f7" }}>
        <div className={`mx-auto transition-all ${width === "mobile" ? "max-w-[360px]" : "max-w-full"}`}>
          <div ref={host} className="min-h-[120px]" />
          {status === "loading" && <p className="py-6 text-center text-sm text-gray-500">Loading preview…</p>}
          {status === "empty" && (
            <p className="py-6 text-center text-sm text-muted">
              No reviews match these choices. Try a lower rating, or switch off &ldquo;Only reviews with a written comment&rdquo;.
            </p>
          )}
          {status === "error" && <p className="py-6 text-center text-sm text-red-600">{message}</p>}
          {!locationsReady && status !== "error" && (
            <p className="pt-2 text-center text-xs text-muted">Tick locations in Settings to see your reviews here.</p>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Every review that could appear in the widget, each with a tick. Untick one to
 * keep it off your website (a 5-star with a bad comment, say). Applies to all
 * your widgets and is saved straight away; the review stays in your inbox and HubSpot.
 */
function ReviewPicker({ draft, onChange }: { draft: Draft; onChange: () => void }) {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    apiFetch<Review[]>("/reviews")
      .then(setReviews)
      .catch((err) => setError(errorText(err, "Could not load reviews")));
  }, []);

  async function toggle(review: Review) {
    const hidden = !review.hiddenFromWidgets;
    setError(null);
    setReviews((list) => list?.map((r) => (r.id === review.id ? { ...r, hiddenFromWidgets: hidden } : r)) ?? null);
    try {
      await apiFetch(`/reviews/${review.id}/widget-visibility`, { method: "PATCH", body: JSON.stringify({ hidden }) });
      onChange();
    } catch (err) {
      setReviews((list) => list?.map((r) => (r.id === review.id ? { ...r, hiddenFromWidgets: !hidden } : r)) ?? null);
      setError(errorText(err, "Could not update that review"));
    }
  }

  // Reviews the current choices would leave out anyway are not worth listing,
  // unless they were hidden by hand (so they can be brought back).
  const eligible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (reviews ?? []).filter((r) => {
      if (q && !`${r.reviewerName} ${r.reviewText}`.toLowerCase().includes(q)) return false;
      if (r.hiddenFromWidgets) return true;
      if (draft.locationIds.length && !draft.locationIds.includes(r.location.id)) return false;
      if (r.rating < draft.minRating) return false;
      if (draft.requireComment && !r.reviewText.trim()) return false;
      return true;
    });
  }, [reviews, draft.locationIds, draft.minRating, draft.requireComment, search]);

  const hiddenCount = (reviews ?? []).filter((r) => r.hiddenFromWidgets).length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Untick a review to keep it off your website, even if it has a high rating. It stays in your inbox and HubSpot. This applies to all your
        widgets and saves straight away.
      </p>
      {error && <Notice kind="error">{error}</Notice>}
      <div className="flex items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or comment"
          className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink"
        />
        <span className="shrink-0 text-xs text-muted">{hiddenCount} hidden</span>
      </div>
      {!reviews ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : eligible.length === 0 ? (
        <p className="text-sm text-muted">No reviews match your choices above.</p>
      ) : (
        <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-lg border border-line">
          {eligible.map((r) => (
            <li key={r.id}>
              <label className={`flex cursor-pointer items-start gap-3 p-3 text-sm hover:bg-surface ${r.hiddenFromWidgets ? "opacity-60" : ""}`}>
                <input type="checkbox" checked={!r.hiddenFromWidgets} onChange={() => toggle(r)} className="mt-1 h-4 w-4 accent-brand-pink" />
                <span className="min-w-0">
                  <span className="font-medium text-ink">{r.reviewerName}</span>{" "}
                  <span className="text-amber-500" aria-label={`${r.rating} stars`}>{"★".repeat(r.rating)}</span>
                  <span className="block truncate text-muted">{r.reviewText.trim() || "No written comment"}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
