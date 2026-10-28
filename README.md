# AI Review Auto-Reply

Automatically replies to Google reviews for ACE Training and MultiSkills Training:
fetch new reviews → draft an on-brand reply from the brand's templates → auto-post the safe ones,
hold risky ones for human approval → post and log the result.

Each brand runs as its own dashboard on its own domain. See **[Two dashboards, two folders](#two-dashboards-two-folders)**.

Built from `ACE & MST_Review_AutoReply_Proposal.pdf` (what the client bought) and `step-by-step.pdf`
(how it should be built).

## Two dashboards, two folders

ACE Training and MultiSkills Training each get their **own dashboard on their own domain**, so the
repo holds two complete, self-contained copies of the app:

```
review-autoreply/
├── ace/              ← ACE Training dashboard      (RTO 21716, 4 campuses)
├── mst/              ← MultiSkills Training dashboard (RTO 40846, 2 campuses)
├── hubspot-app/      ← the same system as a multi-business HubSpot Marketplace app
└── docs/             ← shared documentation
```

`hubspot-app/` is the product version: any business installs it from HubSpot, and reviews are also
saved under HubSpot contacts. See **[hubspot-app/README.md](hubspot-app/README.md)**.

Each folder has its own `backend/` (NestJS API + Prisma), `frontend/` (Next.js dashboard), `.env`,
dependencies and **its own database**. Nothing is shared at runtime: one brand's dashboard cannot
see the other's reviews, and either can be restarted, restored or switched to live posting on its
own.

The features, screens and behaviour are identical in both. The only difference is which brand the
copy is locked to, and that lives in exactly two files per folder:

| File | Sets |
|---|---|
| `backend/src/config/app-brand.ts` | brand name, RTO code used to pick campuses off Google, seeded tone |
| `frontend/src/lib/app-brand.ts` | the brand name shown in the sidebar and browser tab |

Because the copies are independent, **a change to shared behaviour has to be made in both folders.**

## Quick start

Each dashboard runs from its own folder:

```bash
cd ace          # or: cd mst
cp .env.example .env
npm install
npm run db:migrate && npm run db:seed && npm run db:seed-config
npm run dev
```

| | ACE Training | MultiSkills Training |
|---|---|---|
| Folder | `ace/` | `mst/` |
| Dashboard | <http://localhost:3100> | <http://localhost:3110> |
| API | <http://localhost:4000> | <http://localhost:4010> |
| Local database | `review_autoreply_ace_dev` | `review_autoreply_mst_dev` |

The ports differ so both can run side by side. Details, commands and deployment notes are in each
folder's own README: **[ace/README.md](ace/README.md)** · **[mst/README.md](mst/README.md)**.

Full setup instructions including PostgreSQL: **[docs/SETUP.md](docs/SETUP.md)**

## Documentation

| Document | What it covers |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | The processing pipeline and what every module is responsible for |
| [docs/DATABASE.md](docs/DATABASE.md) | Every table, why it exists, and the ER diagram |
| [docs/CREDENTIALS.md](docs/CREDENTIALS.md) | Every secret: what it's for, where to get it, how it's stored |
| [docs/SETUP.md](docs/SETUP.md) | From-scratch local setup, and how to verify it works |

## Build status

Built in phases, each one independently runnable:

| Phase | Status |
|---|---|
| 1. Project structure | ✅ Done |
| 2. PostgreSQL running | ✅ Done |
| 3. Database schema + seed | ✅ Done — 10 tables, migrated and seeded |
| 4. Staff auth (login, JWT) | ✅ Done — verified end to end |
| 5. Review storage, dedupe + edit detection | ✅ Done |
| 6. AI reply generation (OpenAI default; Anthropic/Gemini swappable) | ✅ Done — needs an API key to run |
| 7. Safety & approval routing | ✅ Done — 14 tests passing |
| 8. Slack + email notifications | ✅ Done — needs a webhook/SMTP to send |
| 9. Dashboard UI (Reviews, Alerts, Reports) | ✅ Done |
| 10. Google Business Profile OAuth + live fetch/post | ⬜ Next — needs Google Cloud credentials |
| 11. Scheduled ingestion (cron) | ⬜ |
| 12. Monitoring & hardening | ⬜ |

**Working end to end right now:** sign in; browse the review inbox with live stats; the AI drafts a
reply per review in that brand's configured tone; the safety router auto-approves clean reviews and
holds risky ones — low-rated *or* containing sensitive content, including a 5-star review that hides
a complaint; staff edit / approve / reject from Reviews or Alerts; the monthly report charts real data.

**What is still simulated:** reviews come from a seed script rather than from Google. Connecting a
real Google Business Profile (phase 10) swaps the seed for live fetching and posts approved replies
back — every other stage of the pipeline is already built and does not change.

Try it:

```bash
npm run db:seed-reviews   # 8 sample reviews, incl. a 5-star one containing a complaint
npm test                  # safety router test suite

# then add OPENAI_API_KEY to .env and run the pipeline from the dashboard,
# or: POST /reviews/process with a bearer token
```
