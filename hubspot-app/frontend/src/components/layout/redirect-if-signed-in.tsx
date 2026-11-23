"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { resolveHomePath, useAuth } from "@/lib/auth-context";

/** Sends people who are already signed in straight to setup (until it is complete) or their dashboard. */
export function RedirectIfSignedIn() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) resolveHomePath().then((path) => router.replace(path));
  }, [isLoading, user, router]);

  return null;
}
