# Montra

Cash-flow management for small e-commerce businesses. Built for the National Autumn IT
Tournament, Distributed Applications category. The demo business is **TechStore**, a fictional
online electronics store.

## Architecture

```
apps/web  (React SPA)  ──REST /api/v1──▶  apps/api  (Fastify)  ──Prisma──▶  PostgreSQL
              ▲                                 ▲
              └──── packages/shared (Zod contract + types) ────┘
```

- **apps/web**: React, TypeScript, Vite, Tailwind CSS, Radix UI, Motion. TanStack Query holds
  server state and Zustand holds UI-only state (such as the theme).
- **apps/api**: Fastify REST API. All financial logic and persistence live here.
- **packages/shared**: Zod schemas shared by both sides. The API validates against them, and the
  web client checks every response against them.

All money is stored and sent as **integer cents**. The default currency is EUR.

## Prerequisites

- Node.js 22.12+ (24 recommended, see `.nvmrc`)
- PostgreSQL 17 running locally. On Windows: `winget install PostgreSQL.PostgreSQL.17`

## Getting started

```bash
npm install                          # also generates the Prisma client

# create the databases (adjust credentials to your install)
psql -U postgres -c "CREATE DATABASE montra;" -c "CREATE DATABASE montra_test;"

cp apps/api/.env.example apps/api/.env  # then set the DEMO_* accounts (see below)
npm run db:migrate                   # apply migrations
npm run db:seed                      # TechStore business + configured demo accounts

npm run dev                          # API on :4000, web on :5173
```

### Demo accounts

The seed creates two TechStore accounts for the competition judges, but only when their
credentials are set in `apps/api/.env`. Nothing is hard-coded or committed.

| Variables                                                       | Role                                            |
| --------------------------------------------------------------- | ----------------------------------------------- |
| `DEMO_OWNER_EMAIL`, `DEMO_OWNER_PASSWORD`, `DEMO_OWNER_NAME`    | OWNER: full access, onboarding already complete |
| `DEMO_VIEWER_EMAIL`, `DEMO_VIEWER_PASSWORD`, `DEMO_VIEWER_NAME` | VIEWER: read-only access to TechStore           |

Passwords must be 10–128 characters. Re-running the seed is safe: it updates names and roles and
re-hashes a password only when its configured value changes.

### Authentication

The API issues a 15-minute access token (sent as `Authorization: Bearer …`) and a 30-day refresh
token in an HttpOnly, SameSite=Strict cookie scoped to `/api/v1/auth`. Refresh tokens rotate on
every use and are stored only as SHA-256 hashes; replaying a rotated token revokes all of that
user's sessions. Registration creates the account and its onboarding; the business is created
when onboarding completes.

| Variable                                        | Default    | Notes                                                  |
| ----------------------------------------------- | ---------- | ------------------------------------------------------ |
| `JWT_SECRET`                                    | random     | **Required in production**: 32+ random characters      |
| `ACCESS_TOKEN_TTL_MINUTES`                      | `15`       | 1–60                                                   |
| `REFRESH_TOKEN_TTL_DAYS`                        | `30`       | 1–365                                                  |
| `AUTH_RATE_LIMIT_MAX`, `REFRESH_RATE_LIMIT_MAX` | `10`, `30` | Requests per IP per minute (register + login, refresh) |

### Onboarding

A new account has no business yet. The signed-in user sets one up through `/api/v1/onboarding`:

| Endpoint                      | What it does                                                              |
| ----------------------------- | ------------------------------------------------------------------------- |
| `GET /onboarding`             | Current step, status and saved draft, to resume where the user left off   |
| `PUT /onboarding`             | Saves the current step and replaces the draft (partial, but validated)    |
| `POST /onboarding/complete`   | Creates the business and the user's OWNER membership from the saved draft |
| `GET /businesses/:businessId` | A business the caller belongs to, with their role (404 for anyone else)   |

Completion runs in one transaction and succeeds once per user: repeated or concurrent submissions
get `409 ONBOARDING_ALREADY_COMPLETED`, and an incomplete draft gets `422 ONBOARDING_INCOMPLETE`
with the missing fields. Access to the app comes from memberships, so VIEWER accounts (such as the
judges' demo account) never need to onboard.

In the web app, users without a business land on `/onboarding`: business details, financial
preferences, then a review. Each Continue saves to the API, so setup resumes at the same step on any
device; the dashboard opens only after the API confirms the business was created.

Open http://localhost:5173/status to see the web app, API, and database talking to each other.
The interactive API reference is at http://localhost:5173/api/docs.

## Scripts

| Command              | What it does                                      |
| -------------------- | ------------------------------------------------- |
| `npm run dev`        | Runs API and web together with hot reload         |
| `npm test`           | Vitest across all workspaces (uses `montra_test`) |
| `npm run typecheck`  | TypeScript in every workspace                     |
| `npm run lint`       | ESLint                                            |
| `npm run build`      | Production builds of API and web                  |
| `npm run db:migrate` | Create and apply a migration in development       |
| `npm run db:seed`    | Seed deterministic TechStore data (idempotent)    |
| `npm run db:reset`   | Drop, re-migrate, and re-seed the dev database    |

Integration tests run against `postgresql://postgres:postgres@localhost:5432/montra_test` by
default. Override it with `TEST_DATABASE_URL`.

## Project layout

```
apps/
  api/
    prisma/            schema, migrations, seed
    src/
      config/          validated environment
      plugins/         prisma, error envelope
      modules/         one folder per REST resource
    test/              integration tests (app.inject + test database)
  web/
    src/
      app/             shell (sidebar, top bar), router, providers
      api/             typed fetch client + TanStack Query hooks
      features/        dashboard, transactions, budgets, cashflow,
                       simulations, reports, settings, status
      components/
        ui/            design-system primitives (Button, Panel, Select, Menu…)
        charts/        CapsuleBarChart, LineChart, DonutChart, Sparkline
        finance/       Amount, CategoryIcon, CapsuleProgress, LedgerRow
      demo/            deterministic TechStore sample data (temporary)
      stores/          Zustand (UI state only)
      styles/          design tokens
packages/
  shared/              Zod contract, money helpers
design/                visual reference for the interface
```

## Design system

All colour, radius and type decisions live as tokens in `apps/web/src/styles/index.css`.
Components only use semantic names (`bg-surface`, `text-muted`, `fill-chart-1`), so the dark
signature theme and the light theme stay in sync.

- **Lavender (`chart-1`)** is the analytical voice: charts, insights, simulations.
- **Teal (`accent`, `positive`)** is for primary actions, navigation, and money coming in.
- **Restrained red (`negative`)** is for expenses and unfavourable changes.
- The **capsule chart** (`components/charts/CapsuleBarChart.tsx`) is the signature
  visualisation. It has lavender capsules on slate tracks, a grouped mode for comparisons, and
  hatched capsules for projected months. Budgets and channel shares reuse the same shape as
  horizontal capsules.
- Every chart has a keyboard-accessible readout (arrow keys) and a screen-reader data table.

## Sample data

Until the financial REST endpoints exist, pages read from `apps/web/src/demo`: a
deterministic TechStore dataset generated from documented business rules plus seeded noise, and
anchored to 25 October 2026. The UI marks it with a **Sample data** badge. Pages consume it
through the hooks in `src/api/finance.ts`. Moving to the real API only means replacing those
query functions with `apiRequest` calls. The aggregation and forecasting logic in
`demo/api.ts` then moves to the backend.
