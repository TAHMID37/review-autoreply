"use client";

import type { SyncProgress } from "@/types/api";

/** A progress bar for the running sync, with a plain-language current step. */
export function SyncProgressBar({ progress }: { progress: SyncProgress }) {
  const { percent, step, locationsDone, locationsTotal } = progress;
  return (
    <div className="space-y-1.5" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-sm text-ink">
        <span className="min-w-0 truncate">{step || "Syncing…"}</span>
        <span className="flex-none text-xs text-muted">
          {locationsTotal > 0 ? `${locationsDone} of ${locationsTotal} locations · ` : ""}
          {percent}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface">
        <div className="h-full rounded-full bg-brand-pink transition-all duration-500" style={{ width: `${Math.max(percent, 3)}%` }} />
      </div>
      <p className="text-xs text-muted">This runs in the background. You can leave this page and keep using the app.</p>
    </div>
  );
}
