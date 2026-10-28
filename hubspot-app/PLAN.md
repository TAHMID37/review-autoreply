# Review Auto-Reply: HubSpot App Plan

As of 9 Oct 2026, updated 16 Oct 2026 (reviews saved under HubSpot contacts). Shared doc: https://claude.ai/code/artifact/74ba3162-dc51-4ccf-afd1-0190c9df82e3

## Overview

We will publish our Google review auto-reply system as an app on the HubSpot Marketplace, so any business can install it from HubSpot and run it on its own.

| | |
| --- | --- |
| **What it does** | Pulls Google reviews for the locations a business selects, replies to them automatically (when switched on), and saves every review under a contact in the business's HubSpot, and shows the reviews on their website through an embed widget |
| **How customers pay** | A monthly subscription inside the app |
| **Build time** | 12 working days (12–27 Oct 2026) |
| **Cost to publish** | Free. HubSpot charges no listing fee and takes no share of revenue. |
| **Server** | Our existing server |
| **Live in the Marketplace** | Around 20 Nov 2026 |

## How it works for a customer

A business installs the app, gives access to its Google reviews, picks its locations and chooses a plan. From then on, it is fully self-serve.

1. **Install the app (in HubSpot):** click Install and approve HubSpot's access screen.
2. **Give Google access (on Google):** the Business Profile owner signs in and allows review access.
3. **Pick locations (in our app):** only the ticked locations are synced.
4. **Choose a plan (in our app):** pay by card, billed monthly per location.
5. **Reviews and replies (automatic):** reviews are pulled every 15 minutes, and replies post automatically if switched on.
6. **Reviews appear in HubSpot (automatic):** each review is saved under the reviewer's contact. If the reviewer isn't a contact yet, one is created.
7. **Add the widget (on their website):** copy one code snippet to show reviews on any page.

**About access and safety**

- **Passwords:** access is approved on HubSpot's and Google's own official screens, so we never see their passwords.
- **Who signs in to Google:** the owner or manager of the Google Business Profile. Access lets us read the business's reviews and post replies.
- **Only their own data:** each business sees only its own locations and reviews.
- **Auto-replies:** off until the business switches them on and ticks a consent box. Google requires this consent. Only reviews that arrive after that are replied to.
- **Negative reviews:** 1–2★ reviews with a comment are always held for a person to approve.
- **HubSpot data:** we only add reviews and contacts, and never change or delete a contact the business already had. Contacts we create are labelled so they are easy to find.
- **Removing access:** a business can do this at any time, by uninstalling in HubSpot or removing access in its Google account.

## Features

Most features already run in production for ACE and MultiSkills. The new ones make the product available to any business through HubSpot.

| Feature | What it does | Status |
| --- | --- | --- |
| Google connection | Connects the business's Google Business Profile | Live |
| Location selection | The business picks which locations to manage | New |
| Review sync | Pulls new reviews every 15 minutes, only for the selected locations | Live |
| Auto-reply | Replies using editable templates and star-rating rules, posted on Google as the business owner. The delay is 4 hours for 1–2★ and 24 hours for 3–5★. | Live |
| Approval queue | Negative reviews wait in Alerts for a person to edit and approve | Live |
| AI replies | AI-written replies as an option alongside templates | Live (can be switched on) |
| Dashboard and reports | Overview, Reviews, Alerts and Reports screens, with response rate and weekly volume | Live |
| Notifications | Email and Slack alerts | Live |
| Reviews under contacts | Each review is saved under the reviewer's HubSpot contact, and a contact is created if none exists | New |
| HubSpot app | Install from the Marketplace, log in with HubSpot, use the dashboard inside HubSpot | New |
| In-app billing | Monthly subscription per location, managed inside the app | New |
| Google review widget | Embed code that shows the business's Google reviews on any website | New |

## Reviews saved under HubSpot contacts

In HubSpot, everything lives under a contact. So every Google review is saved under a contact, and the business can see a customer's reviews and replies on that contact's record, next to their other activity.

**What happens when a review arrives**

1. We look for a contact in the business's HubSpot that matches the reviewer.
2. **One clear match:** the review is attached to that contact.
3. **No match:** we create a new contact for the reviewer and attach the review to it.
4. **More than one possible match:** we don't guess. We create a new contact and flag it, so the business can merge it with the right one.
5. When we reply (or the business approves a reply), the reply and its status are shown on the same review.

**What the business sees on a contact**

- Each Google review: star rating, comment, date and a link to the review on Google
- Our reply to it, and whether it is waiting for approval, scheduled or posted
- Contacts we created have the source "Google Review" and a clear label, and a business can filter a list of them

**One limit to be aware of:** Google gives us only the reviewer's display name and profile photo, never their email or phone. So matching is by name only. A reviewer who uses a nickname or a different name on Google will show up as a new contact. The business can merge duplicates with HubSpot's normal merge tool, and an email or phone number added later is kept on the contact.

**How it is saved:** as a "Google Review" record linked to the contact. If a business's HubSpot plan doesn't support custom records, we save each review as a note on the contact instead, so it works on every plan. We confirm this on a test account early in the build.

**Permissions and privacy:** the app asks HubSpot for permission to read and create contacts and to add notes or records to them. Reviewer names are personal data, so the Privacy Policy covers them, and they are removed when the business uninstalls and asks for deletion.

## Billing

Billing is built into the app and runs through Stripe. HubSpot does not handle payments for Marketplace apps, so every Marketplace app bills its customers itself.

- **During setup:** the business chooses a plan and pays by card.
- **Pricing:** a monthly price per location. Adding or removing a location updates the bill automatically.
- **Free trial:** optional. If we offer one, auto-replies start when the trial begins.
- **Billing page:** the business can upgrade, cancel, update its card and download invoices.
- **Failed payment:** syncing and auto-replies pause after a grace period. The business's data is kept.

## Google review widget

The widget shows a business's Google reviews on any page of its website. The business sets it up in the app and copies one snippet.

1. In the app, the business opens **Review widget** and picks the locations, the layout (carousel, grid, list or badge) and the colours.
2. It clicks **Copy embed code** and pastes the snippet into its website. This works on HubSpot pages, WordPress, Wix, Webflow, Shopify or plain HTML.
3. New reviews appear on the website automatically, with no need to update the code.

```html
<div class="ra-reviews" data-widget="wid_8f3k2"></div>
<script src="https://widget.<our-domain>/embed.js" async></script>
```

The widget follows Google's display rules. Each review shows the reviewer's name, the date and a link back to Google. Each widget only works on the website domains the business lists.

## Estimate and timeline

The build takes 12 working days (12–27 Oct 2026). After that, the app goes live around 20 Nov 2026, once 3 businesses have installed it and HubSpot has reviewed it.

| Work | What's included | Estimate |
| --- | --- | --- |
| Open to any business | Separate account and data for each business | 2 days |
| Google access and locations | Google sign-in for any business, location picker, auto-reply consent | 1 day |
| HubSpot app | Install from the Marketplace, HubSpot login, dashboard screens inside HubSpot, uninstall | 3 days |
| In-app billing | Plans, card payment, billing page, invoices (Stripe) | 1 day |
| Reviews under contacts | Contact matching, creating new contacts, saving reviews and replies in HubSpot, merge flag, tests | 2 days |
| Google review widget | Widget settings, live preview, embed code, public review feed | 2 days |
| Testing and listing | Full test, setup guide, Terms, Privacy Policy, listing page and screenshots | 1 day |
| **Total build** | | **12 days (about 2.5 weeks)** |

| When | What happens |
| --- | --- |
| Week 1 (12–16 Oct) | Build, part 1: separate accounts for every business; Google sign-in and location picker; HubSpot install, login and dashboard screens |
| Week 2 (19–23 Oct) | Build, part 2: reviews saved under HubSpot contacts; in-app billing; the Google review widget |
| 26–27 Oct | Final testing, setup guide, Terms, Privacy Policy and the listing page |
| 28 Oct–3 Nov | ACE, MultiSkills and one more business install the app from a private link. Their reviews sync and replies post, so HubSpot sees real use. |
| 4–18 Nov | We submit the app. HubSpot replies within 10 business days. If they ask for changes, we fix them and resubmit. |
| Around 20 Nov | Live in the HubSpot Marketplace. Google's sign-in approval, requested in week 1, runs alongside. |

## Publishing on HubSpot

Publishing is free. The time is spent meeting HubSpot's requirements and waiting for its review.

| Item | Cost | Time |
| --- | --- | --- |
| HubSpot developer account | Free | Same day |
| Listing the app in the Marketplace | Free (no listing fee, no revenue share) | – |
| HubSpot review | Free | First reply within 10 business days |
| Google approval of our sign-in screen | Free | A few weeks, running alongside the build |

**The "3 installs" rule**

HubSpot only accepts a Marketplace submission once 3 real businesses are already using the app.

- **Who counts:** 3 separate companies, each with its own HubSpot account. Our own HubSpot account and test accounts don't count.
- **How they get it:** before the app is public, we send them a private install link.
- **What they have to do:** install the app and use it. Their reviews sync, which counts as activity. HubSpot checks for activity in the last 30 days.
- **Who could do it:** ACE and MultiSkills can be two of them if each has its own HubSpot account. We need one more client.

**What else HubSpot checks**

- The app signs in with HubSpot's own login (OAuth) only.
- There is a public setup guide, Terms of Service, Privacy Policy and support contact.
- The listing shows clear pricing that matches our website.
- If HubSpot asks for changes, the full back-and-forth can take up to 60 days.

**Google approval:** until Google approves our sign-in screen, businesses see an "unverified app" warning when connecting Google, but they can still connect. This doesn't block the HubSpot listing.

## Decisions needed

- [ ] **Price:** the monthly price per location, and whether there's a free trial
- [ ] **Name:** the app's name. It can't include HubSpot or Google.
- [ ] **First 3 businesses:** which businesses install the app first (ACE, MultiSkills and one more)
- [ ] **New contacts:** create a contact for every reviewer with no match (recommended), or only for reviewers who leave a comment
- [ ] **AI replies:** include AI-written replies at launch, or templates only

## Sources

- [HubSpot Marketplace listing requirements](https://developers.hubspot.com/docs/apps/developer-platform/list-apps/listing-your-app/app-marketplace-listing-requirements)
- [HubSpot Technology Partner FAQ](https://www.hubspot.com/hubfs/app-partner-enablement/how-to-become-a-hubspot-app-partner.pdf)
- [Google Business Profile API policies](https://developers.google.com/my-business/content/policies)
