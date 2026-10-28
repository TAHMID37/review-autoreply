"use client";

import { useAuth } from "@/lib/auth-context";

export function Topbar() {
  const { user, logout } = useAuth();
  const initial = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();

  return (
    <header className="flex items-center justify-end gap-3 border-b border-line bg-white px-6 py-3">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-navy text-xs font-semibold text-white">
          {initial}
        </span>
        <span className="text-sm font-medium text-ink">{user?.name || user?.email}</span>
      </div>
      <span className="mx-1 h-5 w-px bg-line" />
      <button
        onClick={logout}
        className="text-sm font-semibold text-brand-pink transition hover:text-brand-pinkDark"
      >
        Sign out
      </button>
    </header>
  );
}
