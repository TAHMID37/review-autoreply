"use client";

import { useCallback, useEffect, useState } from "react";
import { ReviewCard } from "@/components/reviews/review-card";
import { LocationFilter } from "@/components/ui/location-filter";
import { Pagination } from "@/components/ui/pagination";
import { apiFetch } from "@/lib/api-client";
import { DATE_RANGE_LABEL, DATE_RANGES, type DateRange } from "@/lib/date-range";
import { useLocationFilter } from "@/lib/use-location-filter";
import type { ReviewPage } from "@/types/api";

/** The start of the chosen date window as an ISO string, or undefined for all time. */
function sinceFor(range: DateRange): string | undefined {
  if (range === "all") return undefined;
  if (range === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }
  return new Date(Date.now() - (range === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000).toISOString();
}

/** Everything the safety router held back for a person, newest first, for one location or all. */
export default function AlertsPage() {
  const [data, setData] = useState<ReviewPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const { locations, locationId, setLocationId, ready } = useLocationFilter();

  const load = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), tab: "needsApproval" });
    if (locationId) params.set("locationId", locationId);
    const since = sinceFor(dateRange);
    if (since) params.set("since", since);
    try {
      setData(await apiFetch<ReviewPage>(`/reviews/page?${params.toString()}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load alerts");
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, dateRange, locationId]);

  useEffect(() => {
    if (ready) void load();
  }, [load, ready]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, dateRange, locationId]);

  const reviews = data?.items ?? [];
  const total = data?.total ?? 0;

  async function approve(replyId: string, finalReply: string) {
    await apiFetch(`/replies/${replyId}`, { method: "PATCH", body: JSON.stringify({ finalReply }) });
    await apiFetch(`/replies/${replyId}/approve`, { method: "POST" });
    await load();
  }

  async function reject(replyId: string) {
    await apiFetch(`/replies/${replyId}/reject`, { method: "POST" });
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">Alerts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Reviews held for a person - either low-rated, or flagged for sensitive content the star
            rating alone would have missed.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LocationFilter locations={locations} value={locationId} onChange={setLocationId} />
          <select
            value={dateRange}
            onChange={(event) => setDateRange(event.target.value as DateRange)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-ink focus:border-brand-pink focus:outline-none"
          >
            {DATE_RANGES.map((r) => (
              <option key={r} value={r}>
                {DATE_RANGE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}

      {!isLoading && reviews.length === 0 && (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          Nothing waiting for approval{locationId ? " at this location" : ""} in this period.
        </p>
      )}

      <div className="space-y-3">
        {reviews.map((review) => (
          <ReviewCard key={review.id} review={review} onApprove={approve} onReject={reject} />
        ))}
      </div>

      {total > 0 && (
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
      )}
    </div>
  );
}
