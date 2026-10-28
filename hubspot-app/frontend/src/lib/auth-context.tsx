"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { CurrentUser, LoginResponse } from "@/types/api";
import { API_URL, apiFetch, clearStoredToken, getStoredToken, storeToken } from "./api-client";

const NEXT_KEY = "review-autoreply-hubspot:next";

interface AuthContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  /** Full-page redirect to HubSpot's sign-in / install screen. */
  signInWithHubSpot: (next?: string) => void;
  /** Finishes sign-in with the one-time code HubSpot's redirect brought back. */
  completeSignIn: (code: string) => Promise<void>;
  /** Development only: signs in as the seeded demo business. */
  devSignIn: () => Promise<void>;
  /** Where to go after sign-in (remembered across the HubSpot round-trip). */
  takeNextPath: (fallback: string) => string;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    setUser(await apiFetch<CurrentUser>("/auth/me"));
  }, []);

  useEffect(() => {
    if (!getStoredToken()) {
      setIsLoading(false);
      return;
    }
    refreshUser()
      .catch(() => clearStoredToken())
      .finally(() => setIsLoading(false));
  }, [refreshUser]);

  const adopt = useCallback(
    async (session: LoginResponse) => {
      storeToken(session.accessToken);
      await refreshUser();
    },
    [refreshUser],
  );

  const signInWithHubSpot = useCallback((next?: string) => {
    if (next) safeSession(() => window.sessionStorage.setItem(NEXT_KEY, next));
    window.location.href = `${API_URL}/hubspot/install`;
  }, []);

  const completeSignIn = useCallback(
    async (code: string) => {
      await adopt(await apiFetch<LoginResponse>("/auth/exchange", { method: "POST", body: JSON.stringify({ code }) }));
    },
    [adopt],
  );

  const devSignIn = useCallback(async () => {
    await adopt(await apiFetch<LoginResponse>("/auth/dev-login", { method: "POST" }));
  }, [adopt]);

  const takeNextPath = useCallback((fallback: string) => {
    let next: string | null = null;
    safeSession(() => {
      next = window.sessionStorage.getItem(NEXT_KEY);
      window.sessionStorage.removeItem(NEXT_KEY);
    });
    return isSafePath(next) ? next : fallback;
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, signInWithHubSpot, completeSignIn, devSignIn, takeNextPath, refreshUser, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/** Only same-site paths, so a crafted ?next= can't send someone elsewhere. */
export function isSafePath(path: string | null | undefined): path is string {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//");
}

function safeSession(fn: () => void) {
  try {
    fn();
  } catch {
    // Private mode / blocked storage: sign-in still works, it just lands on the default page.
  }
}
