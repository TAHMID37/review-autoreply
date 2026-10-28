"use client";

import { useCallback, useEffect, useState } from "react";
import { ResponseRateMeter } from "@/components/reports/response-rate-meter";
import { WeeklyVolumeChart } from "@/components/reports/weekly-volume-chart";
import { StatTile } from "@/components/reviews/stat-tile";
import { responseScopeLabel } from "@/lib/response-scope";
import { apiFetch } from "@/lib/api-client";
import type { Brand, ReviewStats, WeeklyVolume } from "@/types/api";

export default function ReportsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [weekly, setWeekly] = useState<WeeklyVolume[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const query = selectedBrandId ? `?brandId=${selectedBrandId}` : "";
    try {
      const [loadedStats, loadedWeekly] = await Promise.all([
        apiFetch<ReviewStats>(`/reports/stats${query}`),
        apiFetch<WeeklyVolume[]>(`/reports/weekly-volume${query}`),
      ]);
      setStats(loadedStats);
      setWeekly(loadedWeekly);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the report");
    }
  }, [selectedBrandId]);

  useEffect(() => {
    apiFetch<Brand[]>("/brands").then(setBrands).catch(() => undefined);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Both figures come from the same in-scope set the response rate is measured
  // against, so the meter's two numbers always add up to its denominator. The
  // old "total minus awaiting approval" counted every untouched backlog draft
  // as replied, which it is not.
  const repliedCount = stats?.responseScope.posted ?? 0;
  const awaitingCount = stats ? stats.responseScope.total - stats.responseScope.posted : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">Monthly Report</h1>
          <p className="text-sm text-gray-500">
            {brands.length === 1
              ? brands[0].name
              : selectedBrandId
                ? brands.find((b) => b.id === selectedBrandId)?.name
                : "All brands"}{" "}
            · all campuses
          </p>
        </div>
        {/* Single-brand deployment: a brand picker with one option is just noise. */}
        {brands.length > 1 && (
          <select
            value={selectedBrandId ?? ""}
            onChange={(event) => setSelectedBrandId(event.target.value || null)}
            className="ml-auto rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-pink focus:outline-none"
          >
            <option value="">All brands</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {stats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile value={String(stats.reviewsThisMonth)} label="Reviews this month" />
          <StatTile value={`${stats.averageRating} ★`} label="Average rating" />
          <StatTile
            value={`${stats.responseRate}%`}
            label="Response rate"
            sub={responseScopeLabel(stats)}
            highlight
          />
          <StatTile value={String(stats.needsApprovalCount)} label="Awaiting approval" />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-line bg-white p-4">
          <WeeklyVolumeChart data={weekly} />
        </div>
        <div className="rounded-lg border border-line bg-white p-4">
          {stats && (
            <ResponseRateMeter
              responseRate={stats.responseRate}
              replied={repliedCount}
              pending={awaitingCount}
              caption={stats.responseScope.sinceCutoff ? "Of reviews received since go-live" : "Of all reviews received"}
            />
          )}
        </div>
      </div>

      {stats && (
        <details className="rounded-lg border border-line bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium text-ink">
            View as table
          </summary>
          <table className="mt-3 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase text-gray-500">
                <th className="pb-2">Week</th>
                <th className="pb-2">Replied</th>
                <th className="pb-2">Pending approval</th>
              </tr>
            </thead>
            <tbody>
              {weekly.map((week) => (
                <tr key={week.week} className="border-b border-gray-100">
                  <td className="py-1.5">{week.week}</td>
                  <td className="py-1.5">{week.replied}</td>
                  <td className="py-1.5">{week.pending}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}
