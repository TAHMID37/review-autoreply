# Review Auto-Reply — ACE Training

The ACE Training dashboard: its own app, its own database, its own domain.
MultiSkills Training has a separate, identical one in [`../mst`](../mst). Neither can see the
other's data. See [../README.md](../README.md) for why the project is split this way.

**This app only ever handles ACE Training (RTO 21716, 4 campuses).** Google listings for any
other business — including the other RTO — are skipped on sync and never imported.

## Structure

```
ace/
├── .env              ← this brand's config (gitignored)
├── .env.example      ← the template, committed
├── package.json      ← scripts you run; lists the two workspaces
├── backend/          ← NestJS API + Prisma + PostgreSQL
│   ├── prisma/           schema, migrations, seeds
│   └── src/
│       ├── config/       env validation + app-brand.ts (which brand this is)
│       ├── auth/         login, JWT
│       ├── brands/       tone/rules for this brand
│       ├── locations/    campuses
│       ├── reviews/      storage, dedupe, pipeline orchestration
│       ├── replies/      draft, edit, approve, reject
│       ├── reply-config/ templates + auto-reply rules (the Birdeye config)
│       ├── platform-accounts/ Google OAuth, review sync, reply posting
│       ├── safety/       risk assessment
│       ├── notifications/ Slack + email alerts
│       └── reports/      dashboard stats
└── frontend/         ← Next.js dashboard
    └── src/
        ├── app/          pages
        ├── components/   UI
        ├── lib/          API client, auth state, app-brand.ts
        └── types/        API contract types
```

Shared documentation lives at the repo root in [`../docs`](../docs).

## Quick start

Everything runs from **this folder** (`ace/`), not the repo root.

```bash
cd ace

# 1. Configure — copy the template and fill in your values
cp .env.example .env
#    (see ../docs/CREDENTIALS.md for what each value is and where to get it)

# 2. Install
npm install

# 3. Set up this brand's database
createdb review_autoreply_ace_dev          # or your own Postgres setup
npm run db:migrate                     # create the tables
npm run db:seed                        # brand + admin user
npm run db:seed-config                 # the Birdeye templates + auto-reply rules

# 4. Start both halves together
npm run dev                            # API on :4000, dashboard on :3100
```

Then open <http://localhost:3100> and sign in with the `ADMIN_SEED_EMAIL` /
`ADMIN_SEED_PASSWORD` you set in `.env` before seeding.

Both dashboards can run at the same time: ACE Training uses ports 4000/3100, MultiSkills Training uses
4010/3110.

## Which brand is this?

Two files, one per half of the app:

| File | Sets |
|---|---|
| `backend/src/config/app-brand.ts` | brand name, RTO code used to pick campuses off Google, seeded tone |
| `frontend/src/lib/app-brand.ts` | the brand name shown in the sidebar and the browser tab |

Nothing else is brand-specific — the code, the UI and the features are identical in both folders.

## Common commands

All run from `ace/`:

| Command | What it does |
|---|---|
| `npm install` | Install dependencies for both halves |
| `npm run dev` | Start API **and** dashboard together |
| `npm run dev:backend` | Start only the API |
| `npm run dev:frontend` | Start only the dashboard |
| `npm run build` | Build both halves |
| `npm test` | Run the test suite |
| `npm run db:migrate` | Apply schema changes to this brand's database |
| `npm run db:seed` | Insert the brand, placeholder campuses and admin user |
| `npm run db:seed-config` | Insert this brand's Birdeye templates + auto-reply rules |
| `npm run db:seed-reviews` | Insert sample reviews for development |
| `npm run db:studio` | Open a visual database browser |
| `npm run db:generate` | Regenerate the Prisma client after schema edits |

## Deploying

This folder is self-contained — point the host at `ace/` as the project root and it builds and
runs on its own. Per deployment you need:

- its **own database** (`DATABASE_URL`),
- its **own domain**, set as `WEB_APP_URL`, with `NEXT_PUBLIC_API_URL` pointing at this app's API,
- its **own Google OAuth redirect URI** (`<api domain>/platform-accounts/google/callback`),
  registered in the Google Cloud project alongside the other brand's,
- its own `JWT_SECRET` and `TOKEN_ENCRYPTION_KEY`.

The same Google login can be connected to both dashboards — each one imports only its own campuses.
