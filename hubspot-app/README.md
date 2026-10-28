# Review Auto-Reply — HubSpot Marketplace app

The multi-business edition of the review auto-reply system. Any business can install it from
HubSpot, connect its Google Business Profile, pick its locations and choose a plan. From then on its
reviews sync every 15 minutes, replies post automatically (once switched on, with consent), every
review is saved on the reviewer's HubSpot contact, and an embeddable widget shows the reviews on the
business's website.

The plan this implements is [PLAN.md](PLAN.md).

## How it differs from `../ace` and `../mst`

| | `ace/`, `mst/` | `hubspot-app/` |
|---|---|---|
| Businesses | one brand each, own database | every installed business, one database |
| Sign-in | email + password | **Sign in with HubSpot** (OAuth), no passwords |
| Google locations | filtered by RTO code | the business ticks the ones it wants |
| Auto-reply switch | `AUTO_POST_ENABLED` for the deployment | per business, with recorded consent, plus the platform switch |
| Approval alerts | env `ALERT_EMAIL_TO`, `SLACK_WEBHOOK_URL` | per business, in Settings |
| New | | HubSpot contacts + notes, Stripe billing, website widget, HubSpot app card + home page |

The review pipeline (ingest → draft from templates/rules → hold or schedule → post) is the same code,
and the model is still called `Brand` (one Brand = one HubSpot account) so fixes port across.

## Structure

```
hubspot-app/
├── backend/                NestJS API + Prisma (port 4020)
│   └── src/
│       ├── hubspot/        install / sign-in (OAuth), API client, reviews → contacts,
│       │                   signed endpoints for the HubSpot app card + home page
│       ├── billing/        Stripe checkout, portal, webhooks, per-location quantity
│       ├── widgets/        website widget: settings, public feed, embed.js
│       ├── platform-accounts/  Google connect, 15-min sync, posting replies
│       ├── reviews/ replies/ reply-config/ safety/ notifications/ reports/  (shared pipeline)
│       └── brands/ locations/ users/ auth/
├── frontend/               Next.js dashboard (port 3120)
│                           Setup · Dashboard · Reviews · Alerts · Templates · Rules · Reports
│                           · Review widget · Billing · Settings
└── hubspot-project/        HubSpot developer project (platform 2026.09):
                            app config, "Google reviews" tab on contacts, app home page
```

## Quick start (local)

```bash
cd hubspot-app
cp .env.example .env          # set DATABASE_URL, JWT_SECRET, TOKEN_ENCRYPTION_KEY
                              # and DEV_LOGIN_ENABLED=true, NEXT_PUBLIC_DEV_LOGIN=true
npm install
createdb review_autoreply_hubspot_dev
npm run db:migrate            # tables
npm run db:seed               # a demo business with 2 locations and 8 sample reviews
npm run dev                   # API :4020, dashboard :3120
```

Open <http://localhost:3120/login> and use **Dev sign-in**. Without real HubSpot/Google credentials you
can still try everything that doesn't call them: drafting (`Reviews` → process), approvals, templates,
rules, auto-reply consent, the widget editor with live preview, and settings.

```bash
npm test                      # 65 backend tests
```

## What happens for a business

1. **Install** — the Marketplace button (or our private link) opens `GET /hubspot/install` → HubSpot's
   consent screen → `/hubspot/oauth/callback`. A first-time account becomes a new business with
   starter templates and rules; the installer is its admin. The browser gets a one-time code that the
   dashboard swaps for a session (`POST /auth/exchange`).
2. **Connect Google** — Setup → Connect Google. Every location the login manages is listed, **unticked**.
3. **Pick locations** — only ticked locations sync, and billing is per ticked location.
4. **Choose a plan** — Stripe Checkout (skipped while `BILLING_ENFORCED=false`).
5. **Auto-replies (optional)** — off until an admin ticks the consent box. Only reviews left after that
   moment are auto-replied. 1–2★ with a comment and sensitive reviews always wait in Alerts.
6. **Every 15 minutes** — sync → draft → post what's due → save changed reviews to HubSpot.
7. **Widget** — Review widget → pick layout/colours/locations, list allowed websites, copy the snippet.

### Reviews under HubSpot contacts

Each review becomes a **note** on a contact (notes work on every HubSpot plan; custom objects need
Enterprise). Matching is by name, because Google gives nothing else:

- one clear match → attach to it
- no match → create a contact with *Created from: Google Review*
- several possible matches → create a new contact with *Possible duplicate (Google review)* ticked
- same reviewer name seen before → reuse the contact we already used
- anonymous reviewers → skipped

Existing contacts are never changed; we only add notes. The note is updated in place when the reply
changes (scheduled → posted, etc.). Settings can switch this off or limit new contacts to reviewers
who left a comment.

## Before going live: what still needs doing

| | |
|---|---|
| HubSpot developer account + app | create the app, then `hs project upload` from `hubspot-project/` |
| Real domain | replace `REPLACE-WITH-OUR-DOMAIN` in `hubspot-project/src/app/app-hsmeta.json` and `cards/api.js`, `pages/api.js` |
| Check on a test portal | the points marked **verify** below |
| Google OAuth | add `https://api.<domain>/platform-accounts/google/callback` to the Google Cloud OAuth client; submit the consent screen for verification (until then businesses see "unverified app") |
| Stripe | create the product + monthly per-location Price, webhook to `https://api.<domain>/billing/webhook` with events `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`, enable the customer portal |
| Production env | `NODE_ENV=production`, `REVIEW_SYNC_ENABLED=true`, `AUTO_POST_ENABLED=true`, `BILLING_ENFORCED=true`, `DEV_LOGIN_ENABLED=false`, SMTP |
| Listing | setup guide, Terms, Privacy Policy, support page, demo video, screenshots |

**Verify on a HubSpot test account** (HubSpot's docs could not be fully confirmed while building):

- the dated OAuth endpoints (`/oauth/2026-03/token`, `/token/introspect`); the code falls back to the
  legacy token-info endpoint if introspection fails
- whether HubSpot now needs a separate notes scope (e.g. `crm.objects.notes.write`) to create notes;
  if so add it to `HUBSPOT_SCOPES` and `app-hsmeta.json`
- the `hubspot.fetch` signature arriving as expected at `/hubspot/ext/*` (signed URI must match
  `API_PUBLIC_URL` exactly; a proxy must not strip a path prefix)
- the app-card and home-page config passing `hs project upload` (structure already passes HubSpot's
  parser offline; the full schema check needs an account)
- uninstall: detected when HubSpot refuses the refresh token. HubSpot's app-lifecycle webhooks are not
  wired yet.

## Known limits / next steps

- The scheduler is an in-process timer (fine for one server). Move to a queue before running more
  than one API instance.
- Reviews are stored as notes, not a custom "Google Review" object (works on every plan).
- AI-written replies exist in `backend/src/ai/` but are not wired in (templates only), pending the
  launch decision.
