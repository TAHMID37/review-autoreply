"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isSafePath, resolveHomePath, useAuth } from "@/lib/auth-context";

/** Where HubSpot sign-in lands: swaps the one-time code for a session. */
export default function AuthCallbackPage() {
  const { completeSignIn, takeNextPath } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // Strict mode runs effects twice in development; the code is single-use.
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const serverNext = params.get("next");
    if (!code) {
      setError("Sign-in link is missing its code.");
      return;
    }
    completeSignIn(code)
      .then(async () => {
        // Anyone who has not finished setup goes to setup, wherever they started;
        // otherwise they land on the page they asked for, or the dashboard.
        const home = await resolveHomePath();
        const fallback = isSafePath(serverNext) ? serverNext : home;
        router.replace(serverNext === "/setup" || home === "/setup" ? "/setup" : takeNextPath(fallback));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Sign-in failed"));
  }, [completeSignIn, takeNextPath, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      {error ? (
        <div className="max-w-sm rounded-xl border border-line bg-white p-6 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <a href="/login" className="mt-4 inline-block text-sm font-semibold text-brand-pink">
            Back to sign in
          </a>
        </div>
      ) : (
        <p className="text-sm text-muted">Signing you in…</p>
      )}
    </div>
  );
}
