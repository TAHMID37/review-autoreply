"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatTile } from "@/components/reviews/stat-tile";
import { responseScopeLabel } from "@/lib/response-scope";
import { APP_BRAND } from "@/lib/app-brand";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { Review, ReviewStats } from "@/types/api";

export default function DashboardHomePage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [pending, setPending] = useState<Review[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<ReviewStats>("/reports/stats"),
      apiFetch<Review[]>("/reviews?needsApproval=true"),
    ])
      .then(([s, p]) => {
        setStats(s);
        setPending(p);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the overview"));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Welcome{user?.name ? `, ${user.name}` : ""}</h1>
        <p className="mt-1 text-sm text-muted">
          {APP_BRAND.displayName} - Google reviews and auto-replies across every campus.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {stats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile value={`${stats.averageRating} ★`} label="Average rating" />
          <StatTile value={String(stats.reviewsThisMonth)} label="Reviews this month" />
          <StatTile
            value={`${stats.responseRate}%`}
            label="Response rate"
            sub={responseScopeLabel(stats)}
            highlight
          />
          <StatTile value={String(stats.needsApprovalCount)} label="Awaiting approval" />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-line bg-white p-5 shadow-card lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Waiting for your approval</h2>
            <Link href="/alerts" className="text-xs font-semibold text-brand-pink hover:text-brand-pinkDark">
              View all →
            </Link>
          </div>

          {pending.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              Nothing waiting. Every review has been handled or safely auto-replied.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {pending.slice(0, 4).map((review) => (
                <li key={review.id} className="flex items-start gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-navy text-[11px] font-semibold text-white">
                    {review.reviewerName.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink">{review.reviewerName}</span>
                      <span className="text-xs text-amber-400">{"★".repeat(review.rating)}</span>
                    </div>
                    <p className="truncate text-xs text-muted">{review.reviewText}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-line bg-white p-5 shadow-card">
          <h2 className="text-sm font-semibold text-ink">How replies are routed</h2>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Positive reviews with no sensitive content are drafted and approved automatically. Anything
            low-rated, or flagged for issues like refunds, staff conduct or legal wording, is held here for
            a person to review before it goes public.
          </p>
          <Link
            href="/reviews"
            className="mt-4 inline-flex rounded-lg bg-brand-navy px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-navyDark"
          >
            Open the review inbox
          </Link>
        </div>
      </div>
    </div>
  );
}
