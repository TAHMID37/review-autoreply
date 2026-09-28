"use client";

import { useState } from "react";
import type { Review } from "@/types/api";
import { formatDateTime, formatRelativeTime } from "./relative-time";
import { StarRating } from "./star-rating";

interface ReviewCardProps {
  review: Review;
  onApprove: (replyId: string, finalReply: string) => Promise<void>;
  onReject: (replyId: string) => Promise<void>;
}

export function ReviewCard({ review, onApprove, onReject }: ReviewCardProps) {
  const { reply } = review;
  const needsApproval = reply?.status === "PENDING_APPROVAL";

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(reply?.finalReply ?? reply?.aiDraft ?? "");
  const [isBusy, setIsBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setIsBusy(true);
    try {
      await action();
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <article className="rounded-xl border border-line bg-white p-4 shadow-card">
      <div className="flex items-start gap-3">
        <Avatar name={review.reviewerName} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-gray-900">{review.reviewerName}</span>
            <StarRating rating={review.rating} />
            <span className="text-xs text-gray-500">
              Google · {review.location.name} ·{" "}
              <time dateTime={review.reviewedAt} title={formatRelativeTime(review.reviewedAt)}>
                {formatDateTime(review.reviewedAt)}
              </time>{" "}
              <span className="text-gray-400">({formatRelativeTime(review.reviewedAt)})</span>
            </span>
            <span className="ml-auto">
              <StatusBadge status={reply?.status} />
            </span>
          </div>

          <p className="mt-2 text-sm text-gray-700">{review.reviewText}</p>

          {review.analysis && review.analysis.riskFlags.length > 0 && (
            <p className="mt-2 text-xs text-gray-500">
              Flagged: {review.analysis.riskFlags.join(", ").replace(/_/g, " ")}
            </p>
          )}

          {reply && (
            <div
              className={`mt-3 rounded-md border p-3 ${
                needsApproval ? "border-brand-pink/40 bg-brand-pink/5" : "border-gray-200 bg-gray-50"
              }`}
            >
              <div className="flex gap-2">
                <span className="mt-0.5 rounded bg-brand-navy px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  AI
                </span>
                {isEditing ? (
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    rows={3}
                    className="w-full rounded border border-gray-300 p-2 text-sm focus:border-brand-pink focus:outline-none"
                  />
                ) : (
                  <p className="whitespace-pre-wrap text-sm text-gray-700">{reply.finalReply ?? reply.aiDraft}</p>
                )}
              </div>

              {needsApproval && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => run(() => onApprove(reply.id, draft))}
                    disabled={isBusy}
                    className="rounded-md bg-brand-pink px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-pinkDark disabled:opacity-50"
                  >
                    {isBusy ? "Working…" : "Approve & post"}
                  </button>
                  <button
                    onClick={() => setIsEditing((editing) => !editing)}
                    disabled={isBusy}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 disabled:opacity-50"
                  >
                    {isEditing ? "Cancel" : "Edit"}
                  </button>
                  <button
                    onClick={() => run(() => onReject(reply.id))}
                    disabled={isBusy}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-500 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          )}

          {!reply && (
            <p className="mt-3 text-xs italic text-gray-400">
              No reply drafted yet - run the AI pipeline to generate one.
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-navy text-xs font-semibold text-white">
      {initials}
    </div>
  );
}

const BADGE_STYLES: Record<string, { label: string; className: string }> = {
  POSTED: { label: "Auto-replied", className: "bg-emerald-50 text-emerald-700" },
  APPROVED: { label: "Approved", className: "bg-emerald-50 text-emerald-700" },
  PENDING_APPROVAL: { label: "Needs approval", className: "bg-brand-pink/10 text-brand-pink" },
  GENERATED: { label: "Draft ready", className: "bg-gray-100 text-gray-600" },
  FAILED: { label: "Failed", className: "bg-red-50 text-red-700" },
  REJECTED: { label: "Rejected", className: "bg-gray-100 text-gray-500" },
};

function StatusBadge({ status }: { status?: string }) {
  const badge = status ? BADGE_STYLES[status] : undefined;
  if (!badge) {
    return <span className="rounded px-2 py-0.5 text-[11px] bg-gray-100 text-gray-500">Awaiting reply</span>;
  }
  return <span className={`rounded px-2 py-0.5 text-[11px] ${badge.className}`}>{badge.label}</span>;
}
