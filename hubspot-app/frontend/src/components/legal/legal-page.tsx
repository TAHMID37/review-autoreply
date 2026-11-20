import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/layout/brand-mark";

export const SUPPORT_EMAIL = "support@ibusinessformula.com.au";

/** Shared shell for the public Privacy Policy and Terms pages. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-brand-navy">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href="/login" aria-label="ReviewTune home">
            <BrandMark tone="dark" />
          </Link>
          <nav className="flex gap-5 text-sm font-medium text-white/80">
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10">
        <article className="rounded-2xl bg-white p-6 shadow-card sm:p-10">
          <h1 className="text-3xl font-extrabold text-ink">{title}</h1>
          <p className="mt-1 text-sm text-muted">Last updated: {updated}</p>
          <div className="mt-8 space-y-4 text-[15px] leading-relaxed text-muted">{children}</div>
        </article>
        <p className="mt-6 text-center text-xs text-muted">
          ReviewTune is a product of iBusinessFormula. Questions? Email{" "}
          <a className="text-brand-pink underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </main>
    </div>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="!mt-8 text-lg font-bold text-ink">{children}</h2>;
}

export function UL({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5">{children}</ul>;
}
