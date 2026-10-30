"use client";

export const FIELD_CLASS =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink";
export const PRIMARY_BUTTON =
  "rounded-md bg-brand-pink px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-pinkDark disabled:opacity-50";
export const SECONDARY_BUTTON =
  "rounded-md border border-line bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface disabled:opacity-50";

export function Card({ title, description, action, children }: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-ink">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      {hint && <span className="ml-1 text-xs text-muted">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function Notice({ kind, children }: { kind: "success" | "error" | "info"; children: React.ReactNode }) {
  const styles = {
    success: "border-green-200 bg-green-50 text-green-800",
    error: "border-red-200 bg-red-50 text-red-700",
    info: "border-line bg-surface text-ink",
  }[kind];
  return <p className={`rounded-md border p-3 text-sm ${styles}`}>{children}</p>;
}

export function AdminOnlyHint({ isAdmin }: { isAdmin: boolean }) {
  if (isAdmin) return null;
  return <p className="mt-2 text-xs text-muted">Only an admin of this business can change this.</p>;
}

export function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
