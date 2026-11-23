"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ReviewCard } from "@/components/reviews/review-card";
import { StatTile } from "@/components/reviews/stat-tile";
import { responseScopeLabel } from "@/lib/response-scope";
import { Pagination } from "@/components/ui/pagination";
import { apiFetch } from "@/lib/api-client";
import { LocationFilter } from "@/components/ui/location-filter";
import { useLocationFilter } from "@/lib/use-location-filter";
import { DATE_RANGE_LABEL, DATE_RANGES, type DateRange } from "@/lib/date-range";
import type { ReviewPage, ReviewStats } from "@/types/api";

type Tab = "all" | "needsApproval" | "autoReplied";

const SEARCH_DEBOUNCE_MS = 300;

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

export default function ReviewsPage() {
  const [data, setData] = useState<ReviewPage | null>(null);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const { locations, locationId, setLocationId, ready } = useLocationFilter();

  // Wait for a pause in typing before asking the server to search.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), tab });
    if (search) params.set("search", search);
    if (locationId) params.set("locationId", locationId);
    const since = sinceFor(dateRange);
    if (since) params.set("since", since);
    try {
      const [loaded, loadedStats] = await Promise.all([
        apiFetch<ReviewPage>(`/reviews/page?${params.toString()}`),
        apiFetch<ReviewStats>(`/reports/stats${locationId ? `?locationId=${encodeURIComponent(locationId)}` : ""}`),
      ]);
      setData(loaded);
      setStats(loadedStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load reviews");
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, tab, search, dateRange, locationId]);

  useEffect(() => {
    if (ready) void load();
  }, [load, ready]);

  // A new filter or page size starts again from page 1 with nothing ticked.
  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [tab, search, pageSize, dateRange, locationId]);

  // Ticks only make sense for the page on screen.
  useEffect(() => {
    setSelected(new Set());
  }, [page]);

  const reviews = data?.items ?? [];
  const total = data?.total ?? 0;
  const counts = data?.counts ?? { all: 0, needsApproval: 0, autoReplied: 0 };

  const selectableIds = useMemo(
    () => reviews.filter((r) => r.reply?.status === "PENDING_APPROVAL").map((r) => r.reply!.id),
    [reviews],
  );
  const allOnPageSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  function toggleOne(replyId: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(replyId);
      else next.delete(replyId);
      return next;
    });
  }

  async function approve(replyId: string, finalReply: string) {
    await apiFetch(`/replies/${replyId}`, { method: "PATCH", body: JSON.stringify({ finalReply }) });
    await apiFetch(`/replies/${replyId}/approve`, { method: "POST" });
    await load();
  }

  async function reject(replyId: string) {
    await apiFetch(`/replies/${replyId}/reject`, { method: "POST" });
    await load();
  }

  async function bulk(action: "approve" | "reject", target: { ids?: string[]; allPending?: boolean }, confirmText: string) {
    if (!window.confirm(confirmText)) return;
    setBulkBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await apiFetch<{ done: number; skipped: number }>("/replies/bulk", {
        method: "POST",
        body: JSON.stringify({ action, ...target }),
      });
      setNotice(
        `${result.done} repl${result.done === 1 ? "y" : "ies"} ${action === "approve" ? "approved" : "rejected"}` +
          (result.skipped ? `, ${result.skipped} skipped (already handled).` : "."),
      );
      setSelected(new Set());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk action failed");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold text-ink">Google Reviews</h1>
        <div className="ml-auto">
          <LocationFilter locations={locations} value={locationId} onChange={setLocationId} />
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
        <input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search reviews…"
          className="w-56 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-pink focus:outline-none"
        />
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
          <StatTile value={stats.totalReviews > 0 ? `${stats.averageRating} ★` : "–"} label="Average rating" />
          <StatTile value={String(stats.reviewsThisMonth)} label="Reviews this month" />
          <StatTile
            value={`${stats.responseRate}%`}
            label="Response rate"
            sub={responseScopeLabel(stats)}
            highlight
          />
          <StatTile value={String(stats.autoRepliedCount)} label="Auto-replied" />
        </div>
      )}

      {counts.needsApproval > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white px-4 py-2.5 text-sm">
          <label className="flex items-center gap-2 text-ink">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand-pink"
              checked={allOnPageSelected}
              disabled={selectableIds.length === 0 || bulkBusy}
              onChange={(e) => setSelected(e.target.checked ? new Set(selectableIds) : new Set())}
            />
            Select all waiting on this page ({selectableIds.length})
          </label>
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              disabled={selected.size === 0 || bulkBusy}
              onClick={() =>
                bulk("approve", { ids: [...selected] }, `Approve ${selected.size} selected repl${selected.size === 1 ? "y" : "ies"}? They will be posted to Google.`)
              }
              className="rounded-md bg-brand-pink px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-pinkDark disabled:opacity-50"
            >
              Approve selected ({selected.size})
            </button>
            <button
              disabled={selected.size === 0 || bulkBusy}
              onClick={() => bulk("reject", { ids: [...selected] }, `Reject ${selected.size} selected repl${selected.size === 1 ? "y" : "ies"}? Nothing will be posted for them.`)}
              className="rounded-md border border-line bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface disabled:opacity-50"
            >
              Reject selected
            </button>
            <button
              disabled={bulkBusy}
              onClick={() =>
                bulk(
                  "approve",
                  { allPending: true },
                  `Approve ALL ${counts.needsApproval} replies waiting for approval? This includes low-rated and sensitive reviews that are normally held for a person to read. They will be posted to Google.`,
                )
              }
              className="rounded-md border border-line bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface disabled:opacity-50"
            >
              Approve all {counts.needsApproval} waiting
            </button>
          </div>
        </div>
      )}

      {notice && <p className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {isLoading && <p className="text-sm text-gray-500">Loading reviews…</p>}

      {!isLoading && reviews.length === 0 && (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          No reviews match this filter.
        </p>
      )}

      <div className="space-y-3">
        {reviews.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            onApprove={approve}
            onReject={reject}
            selected={review.reply ? selected.has(review.reply.id) : false}
            onSelectChange={(on) => review.reply && toggleOne(review.reply.id, on)}
          />
        ))}
      </div>

      {total > 0 && (
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
      )}
    </div>
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
