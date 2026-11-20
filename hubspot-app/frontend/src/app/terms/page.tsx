import type { Metadata } from "next";
import { H2, LegalPage, SUPPORT_EMAIL, UL } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service | ReviewTune",
  description: "The terms for using ReviewTune: pricing, your responsibilities and how to cancel.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="20 November 2026">
      <p>
        These terms apply when you install or use ReviewTune, a service of iBusinessFormula (&quot;we&quot;, &quot;us&quot;). By installing
        ReviewTune or signing in, you agree to them on behalf of your business. If you do not agree, do not use the service.
      </p>

      <H2>1. The service</H2>
      <p>
        ReviewTune connects your Google Business Profile to your HubSpot account, saves your Google reviews on matching HubSpot contacts,
        drafts replies from your templates and rules, and (when you turn it on) posts approved replies to Google. It also provides alerts,
        reports and an optional reviews widget for your website.
      </p>

      <H2>2. Your account</H2>
      <UL>
        <li>You must have the authority to connect your HubSpot account and your Google Business Profile.</li>
        <li>Everyone who signs in does so through HubSpot. Keep access to your HubSpot account secure; you are responsible for what is done under it.</li>
        <li>The information you give us must be accurate.</li>
      </UL>

      <H2>3. Free trial, price and billing</H2>
      <UL>
        <li>New businesses get a 3-month free trial. You can cancel at any time during the trial and pay nothing.</li>
        <li>After the trial, the price is <strong className="text-ink">US$25 per location per month</strong>. Adding or removing a location updates your bill automatically.</li>
        <li>Payments are taken by Stripe on the card you provide. We do not see your card details.</li>
        <li>If a payment fails, we may pause syncing and replies until it is resolved.</li>
        <li>We will give you at least 30 days&apos; notice before changing the price.</li>
      </UL>

      <H2>4. Cancelling</H2>
      <p>
        You can cancel at any time by uninstalling ReviewTune from HubSpot or by contacting us. Cancelling stops billing straight away. What
        happens to your data is explained in our <a className="text-brand-pink underline" href="/privacy">Privacy Policy</a>: we erase our
        access immediately and delete your data from our database after 30 days, and we never delete anything in your HubSpot account.
      </p>

      <H2>5. Replies, and your responsibilities</H2>
      <UL>
        <li>
          ReviewTune drafts replies from your templates and rules. Reviews that are low-rated or may involve sensitive matters are held for a
          person to approve. Replies posted automatically are posted <strong className="text-ink">in your name</strong>, and you are responsible for
          them, so check your templates and rules.
        </li>
        <li>You must comply with Google&apos;s and HubSpot&apos;s terms and policies, and with the law, including privacy and consumer law.</li>
        <li>You must not use ReviewTune to post misleading, abusive or unlawful content, to fake or pay for reviews, or to attack or harass reviewers.</li>
        <li>You must not copy, resell, reverse-engineer or overload the service.</li>
      </UL>

      <H2>6. Third-party services</H2>
      <p>
        ReviewTune depends on Google, HubSpot and Stripe. Their availability, limits and terms are outside our control. If one of them changes or
        restricts access, parts of ReviewTune may stop working, and we are not liable for that.
      </p>

      <H2>7. Your data</H2>
      <p>
        You keep ownership of your reviews, replies, settings and HubSpot data. You give us permission to use them only to provide ReviewTune to
        you, as described in our <a className="text-brand-pink underline" href="/privacy">Privacy Policy</a>.
      </p>

      <H2>8. Availability and changes</H2>
      <p>
        We work to keep ReviewTune running but do not promise it will be uninterrupted or error-free. We may improve, change or remove features,
        and will give reasonable notice of changes that significantly affect you.
      </p>

      <H2>9. Disclaimers and liability</H2>
      <p>
        The service is provided &quot;as is&quot;. To the extent the law allows, we exclude all warranties not set out here and are not liable for
        indirect or consequential loss, loss of profits, or loss caused by third-party services. Our total liability for any claim is limited to the
        amount you paid us in the 3 months before the claim arose. Nothing in these terms limits any rights you have under law that cannot be
        excluded, including the Australian Consumer Law.
      </p>

      <H2>10. Suspension and termination</H2>
      <p>
        We may suspend or end your access if you break these terms, do not pay, or use the service in a way that risks harm to others or to the
        service. You may stop using ReviewTune at any time.
      </p>

      <H2>11. Changes and governing law</H2>
      <p>
        We may update these terms and will notify account owners by email before material changes take effect. Continuing to use ReviewTune
        after that means you accept them. These terms are governed by the laws of Australia.
      </p>

      <H2>12. Contact</H2>
      <p>
        <a className="text-brand-pink underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </LegalPage>
  );
}
