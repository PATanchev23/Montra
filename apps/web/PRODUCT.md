# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences carry equal weight in product decisions:

- **Small e-commerce owner-operators** who run their own finances without an accountant at hand. They need to know where their cash stands, where it is heading, and whether they can afford a decision, without learning accounting vocabulary.
- **National Autumn IT Tournament judges** (Distributed Applications category) evaluating Montra through the seeded TechStore demo accounts. The product must hold up as a real tool _and_ read clearly in a short walkthrough.

Roles inside a business: **OWNER** (full access, can change data and import) and **VIEWER** (read-only; the judges' demo account is a VIEWER and never onboards).

## Product Purpose

Montra is cash-flow management for small e-commerce businesses. It brings a store's income and expenses into one ledger, shows the current position, and projects where cash is going so owners can act before a shortfall rather than after. Success means an owner can answer "can I afford this, and when will money get tight?" in minutes, and a judge can see that end to end in one sitting.

## Positioning

Three things together, which a generic bookkeeping or expense tracker cannot truthfully claim:

1. **Forward-looking cash.** A 90-day balance projection from scheduled payments and seasonal averages, and what-if simulations compared against the current plan, not only reports of the past.
2. **Import that meets owners where their data is.** The Montra template, any CSV or any Excel workbook; automatic column mapping from English or Bulgarian headers (e.g. "Amount (EUR)", "Сума, лв."), date-format and decimal-separator detection, and duplicate / possible-duplicate detection. Nothing is saved until the owner confirms.
3. **Clarity for non-accountants.** Plain language and visual explanations; owners never need accounting terms to understand their position.

## Operating Context

- Demo business: **TechStore**, a fictional online electronics store. Sample data is deterministic and anchored to 25 October 2026.
- New accounts go through onboarding (business details → financial preferences → review). Each step saves to the API, so setup resumes on any device; the app opens only once the business exists.
- Owners bring existing data in through a three-step import: upload (`.csv` / `.xlsx`, ≤ 5 MB, ≤ 5,000 rows) → map columns → confirm. The uploaded file itself is never stored; parsed cells expire after 24 hours.
- Owners export transactions and reports as CSV and print reports.
- Main areas: Dashboard, Transactions, Budgets, Cash Flow, Simulations, Reports, plus Settings, Plans and System status.

## Capabilities and Constraints

- **Live on the REST API:** auth (short-lived access token + rotating HttpOnly refresh cookie), onboarding, businesses, transactions (CRUD, filter, sort, paginate), imports, dashboard summary.
- **Still on sample data** (marked in the UI with a **Sample data** label): cash flow, budgets, simulations, reports, notifications, and the dashboard's Upcoming payments and Scenario preview panels, which say which date the sample is anchored to. Moving them to the API changes only the query functions. Building custom simulation scenarios is not available yet.
- **Plans and billing (Stripe):** Free (€0), Pro (€12 / month, marked Recommended) and Business (€29 / month), priced in EUR. Free: one business, dashboard and transactions, budgets, import up to 500 rows a month. Pro adds up to 3 businesses, the 90-day forecast, simulations, reports and CSV export, unlimited import and desktop notifications. Business adds up to 5 businesses, read-only viewer accounts and priority support (business counts set by the user on 24 November 2026). Shown on the Plans page (`/plans`, with a feature comparison) and in a pop-up from **Upgrade** in the sidebar; linked from the account menu and Settings. A plan belongs to the **account**, not a business, and only owners can subscribe. Paying, changing card or plan, and cancelling happen on Stripe-hosted pages (Checkout and the billing portal); the plan follows Stripe through the `/billing/webhook`. **Test mode** while developing: the server refuses a live key outside production, and the UI says no real money moves. **Only the number of businesses is enforced by plan** (Free 1, Pro 3, Business 5; `BUSINESS_LIMITS` in `packages/shared`): the API refuses adding a business beyond it, counting only businesses the account owns. Moving to a smaller plan never takes a business away: every one already owned stays fully usable, only adding another is refused. The first business comes from onboarding; more are added from the business switcher in the sidebar (`/businesses/new`), and the app remembers which business was last open. Every other feature stays open on every plan. Without `STRIPE_SECRET_KEY` the paid plans read "Coming soon". Plan data lives in `src/features/plans/plans.ts`, wording in its `messages.ts`; the Stripe products are `STRIPE_PRODUCT_PRO` / `STRIPE_PRODUCT_BUSINESS` in `apps/api/.env`.
- Money is integer cents everywhere. Default currency **EUR** (Bulgaria joined the euro in 2026); also USD, GBP, CHF, CZK, DKK, HUF, NOK, PLN, RON, SEK. Default time zone Europe/Sofia.
- Transactions have a positive amount and a type (`INCOME` / `EXPENSE`) that gives direction. Only OWNERs can change data; every surface must work read-only for VIEWERs.
- **Language: bilingual English and Bulgarian is required for the tournament.** The whole interface ships in both. Bulgarian is the default for a browser that asks for it first, English otherwise; the choice is saved and can be changed on the sign-in pages, in the account menu and in Settings. Dates, numbers and currency follow the language (`1 234,56 €`, `17 ное 2026`). Text lives in typed `messages.ts` catalogues beside each feature (`src/i18n` holds the shared ones and the translations of API messages); a Bulgarian entry missing or left in English fails the build or the tests. Users' own data (descriptions, categories) is never translated. All copy and layout must keep allowing both languages, including Bulgarian strings 20–30% longer than English.
- Stack (existing): React SPA (Vite, TypeScript, Tailwind, Radix, Motion, TanStack Query, Zustand) → Fastify REST API → Prisma → PostgreSQL, with Zod contracts shared in `packages/shared`.
- Light and dark themes both ship; **light is the default**, and dark stays selectable from the account menu. Preferences saved while dark was the default: a saved "dark" cannot be told apart from that old default, so it moves to light once; "light" and "system" are kept.

## Brand Commitments

- Name: **Montra**. Logo component at `src/components/Logo.tsx`, favicon at `public/favicon.svg`.
- Voice, as established in shipped copy: plain, calm, direct, second person ("Test a decision before you make it."). No accounting jargon.

## Evidence on Hand

- Seeded TechStore business and two demo accounts (OWNER, VIEWER), with credentials supplied via environment only.
- Deterministic TechStore sample dataset in `src/demo`.
- Visual reference: `design/9322b23f-e28d-4928-ad73-5e40a42c9bbd.png` (repo root), the monochrome direction. `design/montra-dashboard-reference.png` is the earlier dark direction it replaced, kept for history only.
- Import template served at `/api/v1/imports/template?format=xlsx|csv`.
- Pricing: the three plans above, set by the user on 23 November 2026. Change prices or tiers only on the user's word.
- **No** real customers, testimonials, usage metrics or press exist. Do not invent them, nor claims built on them (no "most popular" or subscriber counts; Pro is "Recommended").

## Product Principles

1. **Answer the cash question first.** Every surface should help someone know where cash stands and where it is heading; history serves the forecast.
2. **Plain language over accounting language.** If an owner would need a glossary, rewrite it.
3. **Never lose or invent the owner's money.** Integer cents, explicit confirmation before saving imports, clear duplicate handling, and honest labels on sample or projected figures.
4. **Real product, legible demo.** Each feature must work for a real owner and be understandable to a judge in a short walkthrough. No demo-only shortcuts that a real owner would trip over.
5. **Read-only is a first-class role.** VIEWERs see everything an OWNER sees, without dead ends or broken actions.

## Accessibility & Inclusion

- **WCAG 2.2 AA** is the required bar on every surface.
- Keep the established chart patterns: every chart has a keyboard-accessible readout (arrow keys) and a screen-reader data table.
- Respect `prefers-reduced-motion`; reports must print cleanly.
- Both English and Bulgarian (Cyrillic) must be fully supported, including fonts, text expansion and locale formatting.
