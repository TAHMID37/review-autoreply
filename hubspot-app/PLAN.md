# ReviewTune: HubSpot App Plan

As of 9 Oct 2026, updated 16 Oct 2026 (reviews saved under HubSpot contacts) and 9 Nov 2026 (review data stored as contact properties, Option A, plus in-app reports and a rating goal calculator). Shared doc: https://claude.ai/code/artifact/74ba3162-dc51-4ccf-afd1-0190c9df82e3

## Overview

We will publish our Google review auto-reply system as an app on the HubSpot Marketplace, so any business can install it from HubSpot and run it on its own.

| | |
| --- | --- |
| **What it does** | Pulls Google reviews for the locations a business selects, replies to them automatically (when switched on), and saves every review under a contact in the business's HubSpot (as a note, and as filterable contact properties), gives weekly, monthly and yearly reports with a rating goal calculator, and shows the reviews on their website through an embed widget |
| **How customers pay** | A monthly subscription inside the app |
| **Build time** | 17 working days in total (see Estimate and timeline) |
| **Cost to publish** | Free. HubSpot charges no listing fee and takes no share of revenue. |
| **Server** | Our existing server |
| **Live in the Marketplace** | To be re-confirmed once the new start date is agreed (the original date was around 20 Nov 2026) |

## How it works for a customer

A business installs the app, gives access to its Google reviews, picks its locations and chooses a plan. From then on, it is fully self-serve.

1. **Install the app (in HubSpot):** click Install and approve HubSpot's access screen.
2. **Give Google access (on Google):** the Business Profile owner signs in and allows review access.
3. **Pick locations (in our app):** only the ticked locations are synced.
4. **Choose a plan (in our app):** pay by card, billed monthly per location.
5. **Reviews and replies (automatic):** reviews are pulled every 15 minutes, and replies post automatically if switched on.
6. **Reviews appear in HubSpot (automatic):** each review is saved under the reviewer's contact. If the reviewer isn't a contact yet, one is created. The contact's Google review properties (rating, comment, our reply, date, location) are filled in too, so the business can filter and automate on them.
7. **See reports (in our app):** weekly, monthly and yearly reports, and a rating goal calculator.
8. **Add the widget (on their website):** copy one code snippet to show reviews on any page.

**About access and safety**

- **Passwords:** access is approved on HubSpot's and Google's own official screens, so we never see their passwords.
- **Who signs in to Google:** the owner or manager of the Google Business Profile. Access lets us read the business's reviews and post replies.
- **Only their own data:** each business sees only its own locations and reviews.
- **Auto-replies:** off until the business switches them on and ticks a consent box. Google requires this consent. Only reviews that arrive after that are replied to.
- **Negative reviews:** 1–2★ reviews with a comment are always held for a person to approve.
- **HubSpot data:** we only add reviews and contacts, and never change or delete a contact the business already had. Contacts we create are labelled so they are easy to find.
- **Removing access:** a business can do this at any time, by uninstalling in HubSpot or removing access in its Google account.
- **After uninstalling:** syncing stops, billing is cancelled and our stored HubSpot and Google access is erased straight away. Thirty days later we delete the business's reviews, reviewer names and settings from our database (reinstalling within the 30 days cancels the deletion; deleting on request is immediate). We never delete anything in the business's own HubSpot: the notes, contacts and properties we added stay there, because they are the business's records.

## Features

Most features already run in production for ACE and MultiSkills. The new ones make the product available to any business through HubSpot.

| Feature | What it does | Status |
| --- | --- | --- |
| Google connection | Connects the business's Google Business Profile | Live |
| Location selection | The business picks which locations to manage | New |
| Review sync | Pulls new reviews every 15 minutes, only for the selected locations | Live |
| Auto-reply | Replies using editable templates and star-rating rules, posted on Google as the business owner. The delay is 4 hours for 1–2★ and 24 hours for 3–5★. | Live |
| Approval queue | Negative reviews wait in Alerts for a person to edit and approve | Live |
| AI replies | Not in v1 (decided 17 Nov 2026). Replies come from templates and rules only. | Off |
| Dashboard and reports | Overview, Reviews, Alerts and Reports screens, with response rate and weekly volume | Live |
| Notifications | Email alerts (Slack removed 17 Nov 2026) | Live |
| Reviews under contacts | Each review is saved as a note under the reviewer's HubSpot contact (this is the history), and a contact is created if none exists | Built |
| Review properties on contacts | About 8 Google-prefixed properties on the contact (rating, comment, our reply, review date, location, reply status, review link, review count), so reviews can be filtered, listed and automated in HubSpot. Works on every HubSpot plan. | Built 9 Nov, tested in code, not yet tried on a real HubSpot account |
| Reports and rating goal calculator | Weekly, monthly and yearly reports in our app (with CSV download and optional email), and a calculator for how many reviews are needed to reach a target rating | Built 9 Nov, tested in code |
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

**How it is saved:** as a note on the contact, with the rating, comment and our reply. Notes work on every HubSpot plan and keep the full history. Notes alone can't be filtered or reported on, so the latest review is also stored in contact properties (next section).

**Permissions and privacy:** the app asks HubSpot for permission to read and create contacts, add notes to them, and create contact properties. Reviewer names are personal data, so the Privacy Policy covers them, and they are removed when the business uninstalls and asks for deletion.

## Review data as HubSpot properties (Option A)

Decided 9 Nov 2026, from the proposal "Storing Google reviews in HubSpot properly" (3 Nov 2026). Today a review lives only in note text, so a business can't ask HubSpot "how many 5-star reviews did we get this month?" We store the data in real properties instead.

**Why Option A:** it works on every HubSpot plan. The other two designs (a "Google Review" custom object, built in or shipped inside our app) give one record per review, but standard custom objects need Enterprise, and the app-object route needs HubSpot's approval that we could not confirm. Option C stays a possible later add-on (see Decisions).

**What we store on each contact** (all prefixed "Google", in the existing "Google reviews" property group)

| Property | Type | Used for |
| --- | --- | --- |
| Google user rating | Number (1 to 5) | Lists, workflows, segments |
| Google user comment | Text | Seeing what they said |
| Google owner comment | Text | Our reply, written by AI or by hand |
| Google review date | Date | "Reviewed in the last 30 days" |
| Google review location | Text | Filtering by location |
| Google reply status | Text | Waiting, scheduled or posted |
| Google review link | Text | Link back to the review on Google |
| Google review count | Number | "Reviewed more than once" |

**What the business can then do in HubSpot**

- **Lists and views:** rating 2 or less, last review in the last 30 days, review count above 1, a given location.
- **Workflows:** alert the team the moment a 1-2 star review arrives, or start a follow-up task or email for an unhappy reviewer.
- **Segments and campaigns:** target happy 5-star customers for referrals or testimonials.

**The limit:** a contact property holds one value, so the properties show only the **latest** review per contact. Older reviews stay in notes. A business that wants a table of every individual review needs Option B or C.

**Back-fill:** existing reviews are filled in by one re-sync after install.

**Scopes:** the app already has contacts read/write and contact schemas read/write. We still confirm with HubSpot that nothing more is needed for about 8 extra properties.

## Reports and rating goal calculator

HubSpot has no public way for an app to install reports into a customer's account, and we could not confirm that custom reports can use our properties on the Professional plan. So the reports live in our own app, which works on every plan.

- **Reports:** weekly, monthly and yearly, with rating mix, trend, response rate, a per-location split, CSV export and scheduled email.
- **Rating goal calculator:** the business sets a target rating (for example 4.5). The app reads Google's own current average and review count for the location and shows how far away they are. S is the sum of ratings, n is the review count and T is the target.

| Question | Formula |
| --- | --- |
| How many 5-star reviews are needed? | round up of (T x n - S) / (5 - T) |
| How many 1-star reviews would have to be removed? | round up of (T x n - S) / (T - 1) |

Google shows one decimal, so a 4.5 target is really reached at about 4.45. We use the rounded target by default, and Google's own average and total (which include ratings without text) rather than our synced copy.

## Billing

Billing is built into the app and runs through Stripe. HubSpot does not handle payments for Marketplace apps, so every Marketplace app bills its customers itself.

- **During setup:** the business chooses a plan and pays by card.
- **Pricing:** $25 USD per location per month. Adding or removing a location updates the bill automatically.
- **Free trial:** 3 months (decided 17 Nov 2026). Card is collected at checkout; billing starts after the trial. Auto-replies start when the trial begins.
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

The build takes 17 working days in total: the original 12 plus 5 for the review properties, reports and goal calculator added on 9 Nov 2026. The app then goes live once 3 businesses have installed it and HubSpot has reviewed it. The calendar dates in the table below are from the original plan and need to be reset from the new start date.

| Work | What's included | Estimate |
| --- | --- | --- |
| Open to any business | Separate account and data for each business | 2 days |
| Google access and locations | Google sign-in for any business, location picker, auto-reply consent | 1 day |
| HubSpot app | Install from the Marketplace, HubSpot login, dashboard screens inside HubSpot, uninstall | 3 days |
| In-app billing | Plans, card payment, billing page, invoices (Stripe) | 1 day |
| Reviews under contacts | Contact matching, creating new contacts, saving reviews and replies in HubSpot, merge flag, tests | 2 days |
| Review properties on contacts (new) | Create the properties, number and date types, fill them on every review, back-fill existing reviews, tests | 2 days |
| Reports and rating goal calculator (new) | Weekly, monthly and yearly reports, CSV export, scheduled email, goal calculator | 3 days |
| Google review widget | Widget settings, live preview, embed code, public review feed | 2 days |
| Testing and listing | Full test, setup guide, Terms, Privacy Policy, listing page and screenshots | 1 day |
| **Total build** | | **17 days (about 3.5 weeks)** |

The two new rows are estimates and need your confirmation.

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

- [x] **Price:** $25 per location per month (set 10 Nov). Free trial: 3 months (set 17 Nov)
- [ ] **Name:** the app's name. It can't include HubSpot or Google.
- [ ] **First 3 businesses:** which businesses install the app first (ACE, MultiSkills and one more)
- [ ] **New contacts:** create a contact for every reviewer with no match (recommended), or only for reviewers who leave a comment
- [x] **AI replies:** templates only for v1 (set 17 Nov)
- [ ] **Per-review history in HubSpot (Option C):** ask HubSpot whether an app-defined "Google Review" object is allowed for Marketplace apps. If approved, it becomes the main per-review store. If not, it is an Enterprise-only extra. Also ask whether reports can be added to a customer's HubSpot account, and whether the extra contact properties raise any review concerns.

## Sources

- [HubSpot Marketplace listing requirements](https://developers.hubspot.com/docs/apps/developer-platform/list-apps/listing-your-app/app-marketplace-listing-requirements)
- [HubSpot Technology Partner FAQ](https://www.hubspot.com/hubfs/app-partner-enablement/how-to-become-a-hubspot-app-partner.pdf)
- [Google Business Profile API policies](https://developers.google.com/my-business/content/policies)
