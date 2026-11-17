"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type { Location, RatingGoalReport } from "@/types/api";

/** "How many more 5-star reviews do we need to reach 4.5?" */
export function RatingGoalCard() {
  const [target, setTarget] = useState("4.5");
  const [locationId, setLocationId] = useState("");
  const [rounded, setRounded] = useState(true);
  const [locations, setLocations] = useState<Location[]>([]);
  const [result, setResult] = useState<RatingGoalReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch<Location[]>("/locations")
      .then((all) => setLocations(all.filter((l) => l.syncEnabled)))
      .catch(() => undefined);
  }, []);

  async function calculate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const query = `target=${encodeURIComponent(target)}${locationId ? `&locationId=${encodeURIComponent(locationId)}` : ""}&rounded=${rounded}`;
      setResult(await apiFetch<RatingGoalReport>(`/reports/rating-goal?${query}`));
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Could not work that out");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-line bg-white p-4 shadow-card">
      <div>
        <h2 className="text-sm font-medium text-ink">Rating goal</h2>
        <p className="text-xs text-gray-500">
          Pick the rating you want. We use Google&apos;s own average and review count, which include ratings left without
          a comment.
        </p>
      </div>

      <form onSubmit={calculate} className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-gray-700">
          <span className="mb-1 block text-xs text-gray-500">Target rating</span>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            inputMode="decimal"
            className="w-24 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
        </label>
        {locations.length > 1 && (
          <label className="text-sm text-gray-700">
            <span className="mb-1 block text-xs text-gray-500">Location</span>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="">All locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex items-center gap-2 pb-2 text-xs text-gray-600">
          <input type="checkbox" checked={rounded} onChange={(e) => setRounded(e.target.checked)} />
          Count it as reached when Google shows it (rounded)
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-brand-pink px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Working…" : "Calculate"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="rounded-lg border border-line bg-surface/60 p-4">
          <p className="text-xs text-muted">
            {result.scope}: {result.currentAverage} ★ from {result.totalReviews} reviews
            {result.source === "synced" && " (from the reviews synced so far; Google's own figures arrive after the next sync)"}
          </p>
          {result.alreadyReached ? (
            <p className="mt-2 text-lg font-semibold text-green-700">You have already reached {result.target} ★ 🎉</p>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-white p-3 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Get more 5-star reviews</p>
                {result.fiveStarNeeded === null ? (
                  <p className="mt-1 text-sm text-ink">{result.target} ★ can&apos;t be reached by adding 5-star reviews alone.</p>
                ) : (
                  <p className="mt-1 text-ink">
                    <span className="text-3xl font-semibold text-brand-pink">{result.fiveStarNeeded}</span>{" "}
                    <span className="text-sm">more to reach {result.target} ★</span>
                  </p>
                )}
              </div>
              {result.oneStarRemovals !== null && (
                <div className="rounded-lg bg-white p-3 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">Or remove low ratings</p>
                  <p className="mt-1 text-ink">
                    <span className="text-3xl font-semibold text-ink">{result.oneStarRemovals}</span>{" "}
                    <span className="text-sm">1-star {result.oneStarRemovals === 1 ? "review" : "reviews"} removed from Google</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
