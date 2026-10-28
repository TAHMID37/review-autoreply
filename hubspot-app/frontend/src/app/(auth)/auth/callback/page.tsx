"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isSafePath, useAuth } from "@/lib/auth-context";

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
      .then(() => {
        // A brand-new business goes to setup regardless of where it started.
        const fallback = isSafePath(serverNext) ? serverNext : "/dashboard";
        router.replace(serverNext === "/setup" ? "/setup" : takeNextPath(fallback));
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
