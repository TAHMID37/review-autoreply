"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type { SyncProgress } from "@/types/api";

const FAST_POLL_MS = 1500;
const SLOW_POLL_MS = 10000;

/**
 * Live progress of the business's review sync. The sync runs on the server, so
 * it keeps going if the person leaves the page; any page using this hook picks
 * the progress up again.
 */
export function useSyncProgress() {
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wasRunning = useRef(false);
  const [justFinished, setJustFinished] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await apiFetch<SyncProgress>("/platform-accounts/sync/status");
      if (wasRunning.current && next.state !== "running") setJustFinished(true);
      wasRunning.current = next.state === "running";
      setProgress(next);
    } catch {
      // A missed poll is harmless; the next one will catch up.
    }
  }, []);

  const running = progress?.state === "running";
  useEffect(() => {
    void refresh();
    const timer = setInterval(refresh, running ? FAST_POLL_MS : SLOW_POLL_MS);
    return () => clearInterval(timer);
  }, [refresh, running]);

  const start = useCallback(async () => {
    setError(null);
    setJustFinished(false);
    try {
      const next = await apiFetch<SyncProgress>("/platform-accounts/sync", { method: "POST" });
      wasRunning.current = next.state === "running";
      setProgress(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the sync");
    }
  }, []);

  return { progress, running, error, start, justFinished, dismissFinished: () => setJustFinished(false) };
}
