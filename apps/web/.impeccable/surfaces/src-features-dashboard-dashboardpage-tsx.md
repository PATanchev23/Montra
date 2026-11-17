---
version: 1
slug: 'src-features-dashboard-dashboardpage-tsx'
primary_target: 'src/features/dashboard/DashboardPage.tsx'
related_targets: []
---

# Dashboard surface brief

Scope: the signed-in dashboard at `/` and the shared shell and primitives it sits in (Operate mode). The owner or viewer checks where the business's cash stands for a period and what moved it, then drills into Transactions, Cash flow or Simulations.

Audience and task: a small e-commerce owner (or a read-only viewer, including competition judges) reading net position, income and expenses for a period, the trend, where the money went and the latest entries.

Constraints: no new dependencies; no backend, schema or calculation changes; WCAG 2.2 AA; light is the default theme with a neutral dark mirror; Bulgarian-length copy must not break layouts. Figures come from the dashboard API, except Upcoming payments and Scenario preview, which the user chose to show from the existing TechStore sample layer, each labelled Sample data. Other pages inherit the tokens and primitives but are not recomposed in this pass.

## Direction contract

THESIS: A quiet monochrome ledger room where the only expressive form is the capsule: tall light-grey tracks with dark capsules showing how full each period was. It refuses the coloured-accent SaaS dashboard: no teal, purple, gradient, glow or tinted icon tile anywhere.

OWN-WORLD: Warm paper-white canvas (`#F7F7F5`), white panels with a `#E8E8E5` hairline and a 1px-offset whisper shadow, ink `#171717` for text, primary buttons and the active navigation pill. Charts are ink `#252525` on `#E6E6E3` tracks with `#858585` as the second voice and a grey ramp for shares. Green and red appear only on money in, money out and favourable or unfavourable change. Geist throughout, tabular figures at 600. Radii: 16px panels, 10px controls, full pills for segments, badges and every bar.

STORY: The visitor is greeted by name, reads net cash flow, income and expenses with their change against the previous period, sees the period's shape in the capsule chart and can pin any bar, sees which categories took the money and drills into them, checks the latest entries, then looks ahead at upcoming payments and a what-if scenario.

FIRST VIEWPORT: At 1440: a 248px sidebar (logo, flat navigation with an ink pill on the active item, business and account at the foot); a top line with search, the date-range menu and notifications; the greeting at 32px with the period sentence and a pill segmented control for 7, 30 and 90 days at right; three summary tiles (net cash flow, income, expenses) with 28px figures, change and a trend line; then the capsule chart beside a 352px expense breakdown donut. Below the fold: recent transactions, upcoming payments, scenario preview. Under 1280 the rail drops below the chart and the lower panels pair up; under 768 everything stacks, and phones get a bottom tab bar.

FORM: Reference-led summary dashboard: tiles, hero chart with rail, three lists. seed: none (pinned). Pinned by the user's brief and attached reference image: "use the image 9322b23f-e28d-4928-ad73-5e40a42c9bbd from design folder as how i want the website to look"; "Build the visual system around black, white and neutral greys"; "preserve the original vertical capsule charts, but integrate them into the new clean, monochromatic, Apple-inspired dashboard design".

Signature interaction: hovering, tapping or arrowing through the capsules dims the rest and reads out that period's income, expenses and net; a click pins the period until Escape or a second click. The Income / Expenses pill switches the measure and the capsules glide to their new heights.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- DESIGN.md still describes the previous direction. The user asked that it stay untouched until this direction is reviewed and approved.
- The API has no cash balance, upcoming payments or scenarios yet; the first tile is net cash flow and the two forward-looking panels use labelled sample data.
- The rest of the application inherits the tokens and primitives; page-level recomposition waits for approval.
