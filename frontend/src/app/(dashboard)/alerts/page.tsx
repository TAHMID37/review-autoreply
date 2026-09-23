"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ReviewCard } from "@/components/reviews/review-card";
import { Pagination } from "@/components/ui/pagination";
import { apiFetch } from "@/lib/api-client";
import { DATE_RANGE_LABEL, DATE_RANGES, withinRange, type DateRange } from "@/lib/date-range";
import type { Review } from "@/types/api";

/** Everything the safety router held back for a person, newest first. */
export default function AlertsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [dateRange, setDateRange] = useState<DateRange>("all");

  const load = useCallback(async () => {
    try {
      setReviews(await apiFetch<Review[]>("/reviews?needsApproval=true"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load alerts");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, dateRange]);

  const visibleReviews = useMemo(
    () => reviews.filter((r) => withinRange(r.reviewedAt, dateRange)),
    [reviews, dateRange],
  );

  const pagedReviews = useMemo(
    () => visibleReviews.slice((page - 1) * pageSize, page * pageSize),
    [visibleReviews, page, pageSize],
  );

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

      {error && <p className="text-sm text-red-600">{error}</p>}
      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}

      {!isLoading && visibleReviews.length === 0 && (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          Nothing waiting for approval in this period.
        </p>
      )}

      <div className="space-y-3">
        {pagedReviews.map((review) => (
          <ReviewCard key={review.id} review={review} onApprove={approve} onReject={reject} />
        ))}
      </div>

      {visibleReviews.length > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={visibleReviews.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      )}
    </div>
  );
}
