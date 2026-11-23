import Link from "next/link";
import { BrandMark } from "@/components/layout/brand-mark";
import { RedirectIfSignedIn } from "@/components/layout/redirect-if-signed-in";
import { SUPPORT_EMAIL } from "@/components/legal/legal-page";

const FEATURES = [
  {
    title: "Google reviews in HubSpot",
    body: "Every Google review is saved on the reviewer's HubSpot contact, so you see what customers said next to their record.",
  },
  {
    title: "Replies in your voice",
    body: "Write your own reply templates and rules. Happy reviews get a reply drafted from your templates; low-rated or sensitive reviews wait for a person to approve.",
  },
  {
    title: "Alerts and reports",
    body: "Get an email when a review needs attention, plus rating reports you can share with your team.",
  },
  {
    title: "A reviews widget for your website",
    body: "Show your best Google reviews on your own site with a small embeddable widget.",
  },
];

/**
 * Public home page. Server-rendered so people (and Google's reviewers) see what
 * the app is without running scripts. Signed-in users are forwarded to their dashboard.
 */
export default function HomePage() {
  return (
    <div className="min-h-screen bg-surface">
      <RedirectIfSignedIn />
      <header className="bg-brand-navy">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <BrandMark tone="dark" />
          <Link
            href="/login"
            className="rounded-lg bg-brand-pink px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-pinkDark"
          >
            Sign in with HubSpot
          </Link>
        </div>
      </header>

      <main>
        <section className="bg-gradient-to-br from-brand-navy to-brand-navyDark">
          <div className="mx-auto max-w-5xl px-5 pb-16 pt-12 text-white">
            <h1 className="max-w-2xl text-4xl font-extrabold leading-tight sm:text-5xl">
              Your Google reviews, managed from HubSpot.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-white/85">
              ReviewTune connects your Google Business Profile to your HubSpot account. It saves each review on the
              matching contact and helps you reply, with replies drafted from your own templates and anything sensitive
              held for your approval.
            </p>
            <Link
              href="/login"
              className="mt-8 inline-block rounded-lg bg-brand-pink px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-pinkDark"
            >
              Sign in with HubSpot to get started
            </Link>
            <p className="mt-3 text-sm text-white/70">3-month free trial, then US$25 per location per month.</p>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 py-14">
          <h2 className="text-2xl font-extrabold text-ink">What it does</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl bg-white p-6 shadow-card">
                <h3 className="text-lg font-bold text-ink">{f.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 pb-14">
          <div className="rounded-2xl bg-white p-6 shadow-card">
            <h2 className="text-xl font-extrabold text-ink">How it uses your Google data</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              You sign in with HubSpot and then connect your own Google account. ReviewTune reads your business locations and
              reviews, and posts replies only to the reviews of the locations you choose. We never sell your data. If you
              uninstall, your access is erased straight away and your data is deleted from our database 30 days later; nothing
              in your HubSpot account is ever deleted. Read the{" "}
              <Link className="text-brand-pink underline" href="/privacy">Privacy Policy</Link>.
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              ReviewTune&apos;s use and transfer of information received from Google APIs adheres to the{" "}
              <a
                className="text-brand-pink underline"
                href="https://developers.google.com/terms/api-services-user-data-policy"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-muted">
          <span>ReviewTune is a product of iBusinessFormula.</span>
          <nav className="flex gap-5">
            <Link href="/privacy" className="hover:text-ink">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-ink">Terms of Service</Link>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-ink">Support</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
