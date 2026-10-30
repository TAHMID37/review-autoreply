"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/layout/brand-mark";
import { APP_BRAND } from "@/lib/app-brand";
import { isSafePath, useAuth } from "@/lib/auth-context";

const DEV_LOGIN = process.env.NEXT_PUBLIC_DEV_LOGIN === "true";

/**
 * There are no passwords: everyone signs in with HubSpot. The first person
 * from a HubSpot account to do so installs the app for that business.
 */
export default function LoginPage() {
  const { user, isLoading, signInWithHubSpot, devSignIn } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [next, setNext] = useState<string | undefined>(undefined);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("next");
    if (isSafePath(requested)) setNext(requested);
    if (params.get("error")) setError(params.get("error"));
  }, []);

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(next ?? "/dashboard");
    }
  }, [isLoading, user, router, next]);

  function handleHubSpot() {
    setIsRedirecting(true);
    signInWithHubSpot(next);
  }

  async function handleDev() {
    setError(null);
    try {
      await devSignIn();
      router.replace(next ?? "/dashboard");
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Dev sign-in failed");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-navy to-brand-navyDark px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-7">
          <BrandMark tone="light" />
        </div>
        <h1 className="mb-1 text-xl font-bold text-ink">Sign in</h1>
        <p className="mb-6 text-sm text-muted">
          {APP_BRAND.displayName} signs you in with your HubSpot account. New here? This also installs the app.
        </p>

        <button
          onClick={handleHubSpot}
          disabled={isRedirecting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff7a59] py-2.5 text-sm font-semibold text-white transition hover:bg-[#ff5c35] disabled:opacity-60"
        >
          <HubSpotSprocket />
          {isRedirecting ? "Opening HubSpot…" : "Sign in with HubSpot"}
        </button>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <p className="mt-6 text-xs leading-relaxed text-muted">
          You approve access on HubSpot&apos;s own screen, so we never see your password.
        </p>

        {DEV_LOGIN && (
          <button
            onClick={handleDev}
            className="mt-6 w-full rounded-lg border border-dashed border-line py-2 text-xs font-medium text-muted hover:bg-surface"
          >
            Dev sign-in (demo business)
          </button>
        )}
      </div>
    </div>
  );
}

function HubSpotSprocket() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M17.5 8.2V5.9a1.8 1.8 0 1 0-1.6 0v2.3a5.1 5.1 0 0 0-2.4 1.1L7.2 4.4a2 2 0 1 0-1 1.2l6.2 4.8a5.1 5.1 0 0 0 .1 5.8l-1.9 1.9a1.6 1.6 0 1 0 1.1 1.1l1.9-1.9a5.1 5.1 0 1 0 3.9-9.1zm-.8 7.7a2.6 2.6 0 1 1 0-5.3 2.6 2.6 0 0 1 0 5.3z" />
    </svg>
  );
}
