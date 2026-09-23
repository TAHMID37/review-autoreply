"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ReviewCard } from "@/components/reviews/review-card";
import { StatTile } from "@/components/reviews/stat-tile";
import { Pagination } from "@/components/ui/pagination";
import { apiFetch } from "@/lib/api-client";
import { DATE_RANGE_LABEL, DATE_RANGES, withinRange, type DateRange } from "@/lib/date-range";
import type { Brand, Review, ReviewStats } from "@/types/api";

type Tab = "all" | "needsApproval" | "autoReplied";

export default function ReviewsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [dateRange, setDateRange] = useState<DateRange>("all");

  const load = useCallback(async () => {
    setError(null);
    const brandQuery = selectedBrandId ? `?brandId=${selectedBrandId}` : "";
    try {
      const [loadedReviews, loadedStats] = await Promise.all([
        apiFetch<Review[]>(`/reviews${brandQuery}`),
        apiFetch<ReviewStats>(`/reports/stats${brandQuery}`),
      ]);
      setReviews(loadedReviews);
      setStats(loadedStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load reviews");
    } finally {
      setIsLoading(false);
    }
  }, [selectedBrandId]);

  useEffect(() => {
    apiFetch<Brand[]>("/brands").then(setBrands).catch(() => undefined);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleReviews = useMemo(() => {
    const term = search.trim().toLowerCase();
    return reviews.filter((review) => {
      const status = review.reply?.status;
      if (tab === "needsApproval" && status !== "PENDING_APPROVAL") return false;
      if (tab === "autoReplied" && status !== "POSTED" && status !== "APPROVED") return false;
      if (!withinRange(review.reviewedAt, dateRange)) return false;
      if (!term) return true;
      return (
        review.reviewerName.toLowerCase().includes(term) ||
        review.reviewText.toLowerCase().includes(term)
      );
    });
  }, [reviews, tab, search, dateRange]);

  // Reset to the first page whenever the filtered set changes.
  useEffect(() => {
    setPage(1);
  }, [tab, search, selectedBrandId, pageSize, dateRange]);

  const pagedReviews = useMemo(
    () => visibleReviews.slice((page - 1) * pageSize, page * pageSize),
    [visibleReviews, page, pageSize],
  );

  const counts = useMemo(
    () => ({
      all: reviews.length,
      needsApproval: reviews.filter((r) => r.reply?.status === "PENDING_APPROVAL").length,
      autoReplied: reviews.filter((r) => r.reply?.status === "POSTED" || r.reply?.status === "APPROVED")
        .length,
    }),
    [reviews],
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
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold text-ink">Google Reviews</h1>
        <select
          value={dateRange}
          onChange={(event) => setDateRange(event.target.value as DateRange)}
          className="ml-auto rounded-md border border-gray-300 px-2 py-1.5 text-sm text-ink focus:border-brand-pink focus:outline-none"
        >
          {DATE_RANGES.map((r) => (
            <option key={r} value={r}>
              {DATE_RANGE_LABEL[r]}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search reviews…"
          className="w-56 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-pink focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <BrandChip label="All brands" active={selectedBrandId === null} onClick={() => setSelectedBrandId(null)} />
        {brands.map((brand) => (
          <BrandChip
            key={brand.id}
            label={brand.name}
            active={selectedBrandId === brand.id}
            onClick={() => setSelectedBrandId(brand.id)}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-4 border-b border-line text-sm">
        <TabButton label="All" count={counts.all} active={tab === "all"} onClick={() => setTab("all")} />
        <TabButton
          label="Needs approval"
          count={counts.needsApproval}
          active={tab === "needsApproval"}
          onClick={() => setTab("needsApproval")}
        />
        <TabButton
          label="Auto-replied"
          count={counts.autoReplied}
          active={tab === "autoReplied"}
          onClick={() => setTab("autoReplied")}
        />
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile value={`${stats.averageRating} ★`} label="Average rating" />
          <StatTile value={String(stats.reviewsThisMonth)} label="Reviews this month" />
          <StatTile value={`${stats.responseRate}%`} label="Response rate" highlight />
          <StatTile value={String(stats.autoRepliedCount)} label="Auto-replied" />
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {isLoading && <p className="text-sm text-gray-500">Loading reviews…</p>}

      {!isLoading && visibleReviews.length === 0 && (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          No reviews match this filter.
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

function BrandChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-3 py-1 text-xs font-medium ${
        active ? "border-brand-navy bg-brand-navy text-white" : "border-gray-300 bg-white text-gray-600"
      }`}
    >
      {label}
    </button>
  );
}

function TabButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 pb-2 ${
        active ? "border-brand-pink font-medium text-brand-pink" : "border-transparent text-gray-500"
      }`}
    >
      {label} <span className="text-xs">{count}</span>
    </button>
  );
}
