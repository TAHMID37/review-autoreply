"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";

/**
 * Shown on every page while Google is not connected. Without the connection
 * nothing syncs: new reviews do not arrive and replies made on Google are not
 * noticed, so this must not go unseen.
 */
export function GoogleConnectionBanner() {
  const [ok, setOk] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const check = () =>
      apiFetch<{ ok: boolean }>("/platform-accounts/health")
        .then((h) => !cancelled && setOk(h.ok))
        .catch(() => undefined);
    check();
    const timer = setInterval(check, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (ok) return null;
  return (
    <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-800">
      <strong>Google is disconnected.</strong>
      <span>New reviews are not syncing, and replies made on Google will not show here until you reconnect.</span>
      <Link href="/settings" className="font-semibold underline">
        Reconnect in Settings
      </Link>
    </div>
  );
}
