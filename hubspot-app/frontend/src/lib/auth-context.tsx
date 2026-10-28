"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { AuthUser, LoginResponse } from "@/types/api";
import { apiFetch, clearStoredToken, getStoredToken, storeToken } from "./api-client";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Adopts a session the API just handed back — used after changing your own
   *  login details, so the dashboard stays signed in with the new token. */
  applySession: (session: LoginResponse) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!getStoredToken()) {
      setIsLoading(false);
      return;
    }
    apiFetch<AuthUser>("/auth/me")
      .then(setUser)
      .catch(() => clearStoredToken())
      .finally(() => setIsLoading(false));
  }, []);

  const applySession = useCallback((session: LoginResponse) => {
    storeToken(session.accessToken);
    setUser(session.user);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      applySession(result);
    },
    [applySession],
  );

  const logout = useCallback(() => {
    clearStoredToken();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, isLoading, login, applySession, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
