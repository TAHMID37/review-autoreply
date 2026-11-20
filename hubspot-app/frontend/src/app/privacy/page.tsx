import type { Metadata } from "next";
import { H2, LegalPage, SUPPORT_EMAIL, UL } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy | ReviewTune",
  description: "What ReviewTune collects, how it is used, how long it is kept and how to have it deleted.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="20 November 2026">
      <p>
        ReviewTune (&quot;ReviewTune&quot;, &quot;we&quot;, &quot;us&quot;) is operated by iBusinessFormula. It connects a business&apos;s Google
        Business Profile to its HubSpot account, saves Google reviews on the matching HubSpot contacts, and helps the business reply to
        those reviews. This policy explains what we collect, why, who sees it and how to have it deleted.
      </p>

      <H2>1. What we collect</H2>
      <p><strong className="text-ink">From HubSpot</strong> (when you install or sign in):</p>
      <UL>
        <li>Your HubSpot account (portal) ID and domain, and the name and email address of the people who sign in.</li>
        <li>Access tokens that let ReviewTune act in your HubSpot account, limited to the permissions shown on HubSpot&apos;s approval screen.</li>
        <li>Contacts we match to reviewers, and the notes and properties we add to them.</li>
      </UL>
      <p><strong className="text-ink">From Google</strong> (when you connect your Google Business Profile):</p>
      <UL>
        <li>The Google account name and email that approved the connection, and an access token for it.</li>
        <li>Your business locations (name, address, Google location ID).</li>
        <li>Your reviews: the reviewer&apos;s public display name and photo, star rating, review text, date, and any reply already on the review.</li>
      </UL>
      <p><strong className="text-ink">That you give us:</strong> reply templates, auto-reply rules, alert email addresses, review widget settings, and the replies we draft, you approve or we post.</p>
      <p>
        <strong className="text-ink">Billing:</strong> payments are handled by Stripe. We keep your subscription status and Stripe customer
        reference. We never see or store your card number.
      </p>
      <p>
        <strong className="text-ink">Technical data:</strong> basic logs (time of requests, errors, job results) used to run and secure the service.
        We use only the cookies needed to keep you signed in. We use no advertising or tracking cookies.
      </p>

      <H2>2. How we use it</H2>
      <UL>
        <li>To sync your Google reviews and show them in the ReviewTune dashboard.</li>
        <li>To draft replies from your templates and rules, hold sensitive reviews for your approval, and post approved replies to Google.</li>
        <li>To save each review on the reviewer&apos;s HubSpot contact so you can see it alongside your customer records.</li>
        <li>To show an optional reviews widget on your website.</li>
        <li>To email you alerts and reports you have asked for, to bill you, to provide support, and to keep the service secure.</li>
      </UL>
      <p>We do not sell your data, use it for advertising, or use it to build profiles for any other purpose.</p>

      <H2>3. Google user data (Limited Use)</H2>
      <p>
        ReviewTune&apos;s use and transfer of information received from Google APIs adheres to the{" "}
        <a className="text-brand-pink underline" href="https://developers.google.com/terms/api-services-user-data-policy">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements. In particular:
      </p>
      <UL>
        <li>We use Google data only to provide and improve the review-management features you see in ReviewTune.</li>
        <li>We do not transfer it to others except as needed to provide the service, to comply with law, or as part of a merger or sale with notice to you.</li>
        <li>We do not use it for advertising, and we do not sell it.</li>
        <li>Humans at ReviewTune do not read your Google data unless you ask us to for support, it is needed to investigate abuse or a security issue, or the law requires it.</li>
        <li>We do not use Google data to train generative AI models.</li>
      </UL>

      <H2>4. Who we share data with</H2>
      <p>Only the service providers needed to run ReviewTune, and only for that purpose:</p>
      <UL>
        <li><strong className="text-ink">HubSpot</strong>: your own HubSpot account, where we write the review notes and properties.</li>
        <li><strong className="text-ink">Google</strong>: to read your reviews and post your replies.</li>
        <li><strong className="text-ink">Stripe</strong>: to take payment for your subscription.</li>
        <li><strong className="text-ink">Hosting and email delivery providers</strong>: to store data and send the alert emails you request.</li>
      </UL>
      <p>We may disclose information if the law requires it.</p>

      <H2>5. Security</H2>
      <UL>
        <li>All traffic uses HTTPS.</li>
        <li>Google and HubSpot access tokens are encrypted before they are stored.</li>
        <li>Every business&apos;s data is kept separate: one business can never see another&apos;s reviews or settings.</li>
        <li>Sign-in is through HubSpot, so we never see or store your password.</li>
        <li>Access to our servers is limited to the people who run the service.</li>
      </UL>
      <p>No system is perfectly secure, but we work to protect your data and will tell you promptly if a breach affects you.</p>

      <H2>6. How long we keep it, and deleting it</H2>
      <UL>
        <li>
          <strong className="text-ink">When you uninstall ReviewTune:</strong> syncing stops, your subscription is cancelled, and your stored
          Google and HubSpot access is revoked and erased straight away. 30 days later we permanently delete your reviews, reviewer names,
          replies, settings and users from our database. If you reinstall within those 30 days, the deletion is cancelled.
        </li>
        <li>
          <strong className="text-ink">Delete it sooner:</strong> email {SUPPORT_EMAIL} from the address on your account and we will delete it
          immediately.
        </li>
        <li>
          <strong className="text-ink">Your HubSpot is never touched.</strong> The notes, contacts and properties ReviewTune added to your
          HubSpot account belong to you and stay there. You can remove them yourself in HubSpot at any time.
        </li>
        <li>You can also revoke ReviewTune&apos;s access in your Google account permissions at any time.</li>
        <li>Billing records may be kept for as long as tax and accounting law requires.</li>
      </UL>

      <H2>7. Your rights</H2>
      <p>
        You can ask us to access, correct or delete the personal information we hold about you. Email {SUPPORT_EMAIL} and we will respond
        within 30 days. If you are in Australia, you may also complain to the Office of the Australian Information Commissioner; if you are in
        the EU or UK, you may complain to your local data protection authority.
      </p>

      <H2>8. Reviewers&apos; information</H2>
      <p>
        Reviews are public on Google. We handle reviewers&apos; names and review text only to provide the service to the business they reviewed,
        and a reviewer can ask us to delete their information through the same email address.
      </p>

      <H2>9. Children</H2>
      <p>ReviewTune is for businesses and is not directed to children under 16.</p>

      <H2>10. Changes to this policy</H2>
      <p>
        If we change this policy in a way that matters, we will update the date above and notify account owners by email before the change takes effect.
      </p>

      <H2>11. Contact</H2>
      <p>
        iBusinessFormula, ReviewTune support:{" "}
        <a className="text-brand-pink underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </LegalPage>
  );
}
