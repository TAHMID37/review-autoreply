"use client";

import { SyncProgressBar } from "@/components/setup/sync-progress-bar";
import { useSyncProgress } from "@/lib/use-sync-progress";

/** Shown on every page while a sync is running, so progress is never lost by navigating away. */
export function SyncBanner() {
  const { progress, running } = useSyncProgress();
  if (!running || !progress) return null;
  return (
    <div className="border-b border-line bg-white px-6 py-3">
      <SyncProgressBar progress={progress} />
    </div>
  );
}
