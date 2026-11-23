# ReviewTune: launch status and runbook

**Living document. Update it whenever something changes** (status, credentials, settings, decisions). It holds no secret values, only where each one lives.

Last updated: 23 Nov 2026

## 1. What it is

ReviewTune ("AI Review Management") is a multi-business HubSpot Marketplace app. A business installs it from HubSpot, connects its own Google Business Profile, and its Google reviews are synced, saved on the reviewer's HubSpot contact, and replied to from the business's own templates and rules.

- Live: https://reviewtune.ibusinessformula.com.au (dashboard `/`, API `/api/`)
- Code: `hubspot-app/` in the repo `TAHMID37/review-autoreply` (branch `main`)
- Stack: NestJS + Prisma + Postgres (API), Next.js 14 (dashboard), `hubspot-project/` (HubSpot app card and home page)
- Brand: navy #125383, magenta #D1035A, Raleway; assets in `brand/` (source: `ReviewTune-Brand-Set.pdf`)
- Not the same as ACE and MultiSkills: those are separate single-business dashboards (see section 9). They share only the Google Cloud project.

## 2. Product decisions

- Price: US$25 per location per month, per synced (ticked) location. Free trial: 3 months (`STRIPE_TRIAL_DAYS=90`).
- AI replies are off (`AI_PROVIDER=mock`): replies come from the business's own templates and rules. No reply tone setting.
- Slack integration removed. Alerts are by email only.
- Low-rated (1-2 stars with a comment) and sensitive reviews are always held for a person to approve.
- After uninstall: syncing stops, billing is cancelled, and our stored HubSpot and Google access is revoked and erased straight away. 30 days later the business's data is deleted from OUR database (`RETENTION_DAYS=30`). Reinstalling within 30 days cancels the deletion. Nothing is ever deleted from the customer's HubSpot. Deleting on request is immediate.
- Privacy Policy and Terms are drafts, not reviewed by a lawyer. Assumed: operator "iBusinessFormula", Australian law, 30-day response to data requests. Get them reviewed before launch.

## 3. Status checklist

### Done
- [x] App built: reviews sync, HubSpot contact notes and properties, templates, rules, alerts, reports, widget, billing code, retention, uninstall webhook
- [x] Security hardening (OAuth nonce, helmet, rate limits, session recheck, input limits, token erasure on uninstall)
- [x] Rebrand to ReviewTune (name, logo, colours, favicon)
- [x] Public pages: home `/`, `/privacy`, `/terms`
- [x] Deployed to the live server with HTTPS (section 4)
- [x] HubSpot project uploaded (build #3) with the live redirect URL; install and sign-in tested
- [x] Google connect and first sync tested (32 reviews, 0 posted)
- [x] Google Cloud project: In production, External, scope `business.manage` (non-sensitive), branding verified, API quota approved (section 6)

### Still to do (in order)
- [x] Google connect from an outside account tested (23 Nov, works)
- [x] Second HubSpot account install tested (23 Nov, works)
- [ ] Stripe: keys, price, webhook (section 7)
- [ ] Test a real uninstall: uninstall from a test HubSpot account, wait up to 5 min, check `journalctl -u reviewtune-api | grep -i uninstall` (poller built and subscribed 23 Nov; payload format unconfirmed)
- [ ] Remove the `http://localhost:4020/...` redirect URL from `hubspot-project/src/app/app-hsmeta.json` and re-upload, before submitting the listing
- [ ] Email alerts: set up SMTP (section 7)
- [ ] Turn on scheduled sync (`REVIEW_SYNC_ENABLED=true`), then posting (`AUTO_POST_ENABLED=true`) once ready
- [ ] Lawyer review of Privacy Policy and Terms; add company number and address if needed
- [ ] HubSpot Marketplace listing: description, screenshots, support email, docs link; the 3 active installs; submit for review
- [ ] Commit and push the latest home-page changes

### Later (after launch)
- Upgrades for remaining npm audit items (Next 14 to 16, NestJS 10 to 12, zod 3 to 4)
- Move the login token from localStorage to an httpOnly cookie
- Fix the free trial restarting on delete and reinstall
- Production server hardening review (firewall, backups, log rotation)
- Optional "remove what we added to HubSpot" button (not requested)

## 4. Infrastructure (live server)

Same VPS as ACE and MultiSkills and other iBF projects: `ssh root@173.249.27.108` (key auth). Ubuntu 24.04. Other apps run here, so only ever ADD; never edit their files.

| Item | Value |
|---|---|
| Folder | `/var/www/reviewtune` |
| Services | `reviewtune-api` (port 4020), `reviewtune-web` (port 3120) |
| Database | Docker container `reviewtune-db` (postgres:16), 127.0.0.1:5440, db `reviewtune`, user `review`, password in `/root/.reviewtune-dbpw` |
| nginx site | `/etc/nginx/sites-available/reviewtune` (dashboard `/`, API `/api/` with the prefix stripped) |
| HTTPS | Let's Encrypt cert for `reviewtune.ibusinessformula.com.au`, expires 18 Feb 2027, auto-renews |
| DNS | Cloudflare A record `reviewtune` to 173.249.27.108, set to **DNS only** (grey cloud), same as ACE and MultiSkills |
| nginx backup | `/root/nginx-backup-20261120` (taken before the first change) |
| Ports in use on the box | 3000, 3002, 3004, 3005, 3100, 3110, 3120, 4000, 4010, 4020, 5433, 5435-5440, 6333-6336, 8765. Check before adding anything. |

Redeploy (code only; never copy `.env`):
```
cd hubspot-app
rsync -az --exclude node_modules --exclude /.env --exclude .next --exclude dist --exclude '*.pdf' --exclude '*.zip' ./ root@173.249.27.108:/var/www/reviewtune/
ssh root@173.249.27.108 'cd /var/www/reviewtune && npm ci && npm run db:generate && npm run build && npm run db:deploy && systemctl restart reviewtune-api reviewtune-web'
```
(`npm ci` only if dependencies changed; `db:deploy` only if there are new migrations.)

Useful: `journalctl -u reviewtune-api -f`, `docker exec reviewtune-db psql -U review -d reviewtune`.

Before and after any change, confirm the other sites still return 200: `replyreviews.aceassessment.com.au`, `replyreviews.multiskills.com.au`.

## 5. Configuration and safety switches

Server config is `/var/www/reviewtune/.env` (chmod 600). Local dev is `hubspot-app/.env` (gitignored). `.env.example` documents every variable.

| Setting | Server now | Meaning |
|---|---|---|
| `API_PUBLIC_URL` | `https://reviewtune.ibusinessformula.com.au/api` | Must include `/api`: HubSpot signs the full URL and redirect URLs are built from it |
| `REVIEW_SYNC_ENABLED` | `false` | Scheduled 15-minute sync is off. A first sync still runs when a business picks locations. |
| `AUTO_POST_ENABLED` | `false` | Master switch for posting replies to Google. Keep off until ready. A business must also turn on auto-replies itself. |
| `POST_DRY_RUN` | `false` | If true, posting is logged but never sent |
| `BILLING_ENFORCED` | `false` | While false, every business is treated as paid |
| `RETENTION_ENABLED` / `RETENTION_DAYS` | `true` / `30` | Deletes uninstalled businesses from our database after 30 days |
| `DEV_LOGIN_ENABLED`, `NEXT_PUBLIC_DEV_LOGIN` | `false` | Dev sign-in must stay off in production |

Changing a `NEXT_PUBLIC_*` value needs a rebuild of the dashboard, not just a restart.

## 6. Google (Cloud project `ibf-review-autoreply`)

- Login: `support@ibusinessformula.com.au` (organisation `ibusinessformula.com.au`). The Google client ID and secret are shared with ACE and MultiSkills (one client); ReviewTune's copy is in its server `.env`.
- Redirect URI registered on the client: `https://reviewtune.ibusinessformula.com.au/api/platform-accounts/google/callback`
- Google Auth Platform: user type External, publishing status In production (switched 20 Nov 2026), scope `https://www.googleapis.com/auth/business.manage` (listed as non-sensitive, so the 100-user cap should not apply), branding verified (ReviewTune, logo, support email).
- APIs enabled: Google My Business API (and the Account Management and Business Information APIs). Quota approved: 3,000 v4 requests per minute, 600 per minute and 250,000 per day general, 300 per minute and 10,000 per day for reply updates. All adjustable; the limits are shared by every customer, so set an alert at 90%.
- Search Console: `https://ibusinessformula.com.au/` is verified as a URL-prefix property. A Domain property was offered but skipped; add it only if Google asks.
- Watch for: if an outside customer ever sees an "unverified app" screen, the scope may need review; send the screenshot.
- Copy for any Google review: `GOOGLE-VERIFICATION.md` (scope justification and demo video script).

## 7. Credentials: what is needed and where it lives

Never paste secret values into this file or into chat if avoidable. Put them in the server `.env`.

| Credential | Status | Where |
|---|---|---|
| HubSpot client ID and secret | Done | Server `.env` and local `.env`; shown in the HubSpot developer account, app Auth tab |
| HubSpot developer account | Done | Developer test account 1, account ID 50261975, project `review-auto-reply`, app ID 59758472 |
| HubSpot CLI login | Done | `~/.hscli/config.yml` on the dev laptop (personal access key) |
| Google client ID and secret | Done | Server `.env` (copied from ACE's) |
| JWT secret, token encryption key, DB password | Done (generated on the server) | Server `.env`; back up the encryption key, losing it makes every stored token unreadable |
| Stripe secret key, price ID, webhook secret | **Needed** | Server `.env` (`STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`). Create the product with `scripts/stripe-setup.mjs`, then add the webhook `https://reviewtune.ibusinessformula.com.au/api/billing/webhook`. Start in Stripe test mode. |
| SMTP login (for alert emails and reports) | **Needed** | Server `.env` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`). Add SPF and DKIM DNS records for the sending domain. |
| Sentry DSN | Optional | Server `.env` (`SENTRY_DSN`) |

## 8. HubSpot app state

- Project uploaded to Developer test account 1 as build #3 (20 Nov 2026), including the app card and the home page.
- Required scopes: `oauth`, `crm.objects.contacts.read`, `crm.objects.contacts.write`, `crm.schemas.contacts.read`, `crm.schemas.contacts.write`.
- Redirect URLs registered: the live URL `https://reviewtune.ibusinessformula.com.au/api/hubspot/oauth/callback` and `http://localhost:4020/hubspot/oauth/callback` (remove the localhost one before submitting).
- Redeploy: `cd hubspot-project && npx --yes -p @hubspot/cli@8.18.0 hs project upload`
- Validate first: `npm run hs:validate`
- Uninstall detection: HubSpot has no uninstall push. The API polls HubSpot's webhooks journal every 5 min (`HUBSPOT_UNINSTALL_POLL_ENABLED=true`), subscription id 60446309 (APP_LIFECYCLE_EVENT 4-1916193), app-level client-credentials token. A reinstall after a missed uninstall is also detected at sign-in. The old `/hubspot/webhooks` endpoint was removed. The uninstall payload format is still unconfirmed until a real uninstall is observed.

## 9. Related: ACE and MultiSkills (separate apps, same server)

- ACE `replyreviews.aceassessment.com.au` (api 4000, web 3100) and MultiSkills `replyreviews.multiskills.com.au` (api 4010, web 3110). Their own DBs and services (`review-ace-*`, `review-mst-*`). Folders `/var/www/review-autoreply-ace` and `-mst`.
- They share the Google Cloud project with ReviewTune. After the 20 Nov 2026 switch to External/In production, both were still CONNECTED.
- New (committed 20 Nov): a "Google is disconnected" banner with a Reconnect link. Larissa saw the banner; it is a safety disconnect from Google, no data is lost, reconnecting fixes it.
- Larissa's request for negative-review email alerts: offered two options (Google's own notifications, or a custom alert built in). Quoted about 8 to 9 hours for the custom one. Awaiting her answer.

## 10. Test data currently in the system

- One test business on the live server: "Developer Test Account 1 Dev 50261975" (the support@ login).
- Google connected as the support account; 26 locations discovered, only `iBusinessFormula` is ticked (32 reviews synced, 29 already had replies, 3 drafts, 0 posted).
- 32 review notes and the review properties were written into the Developer test account 1 HubSpot (a test account).
- Clean up before real launch if wanted: delete this test business, or leave it.

## 11. Open risks

- Google OAuth: the first real outside connection is untested.
- HubSpot's uninstall event format is unconfirmed.
- Marketplace listing rules (3 installs, assets) were not read from HubSpot's current checklist; check them.
- The Terms and Privacy Policy are unreviewed drafts.
- Google quota is shared by all customers.

## 12. Change log

- 23 Nov 2026: Stripe sandbox set up on the server (US$25 price, webhook, 90-day trial, BILLING_ENFORCED=true); checkout tested; uninstall poller built; reinstall after a missed uninstall now restarts setup.
- 23 Nov 2026 (built locally, NOT yet deployed): sign-in lands on Setup until setup is complete; "Save and sync" sits in the Locations card; sync runs in the background with a progress bar (also shown on every page); connecting a different Google login replaces the old one and removes its locations; Reviews page paginates on the server and has bulk approve/reject.
- 20 Nov 2026: rebranded to ReviewTune; added Privacy, Terms and a public home page; deployed to the live server; HubSpot project build #3 uploaded; first install, Google connect and sync tested; Google project switched to External, In production; branding verified; quota confirmed.
- 19 Nov 2026: security hardening, uninstall webhook and 30-day retention built; brand assets received.
- 17 Nov 2026: 3-month trial added; Slack and AI replies removed.
