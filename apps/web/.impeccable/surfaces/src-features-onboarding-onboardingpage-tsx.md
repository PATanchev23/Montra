---
version: 1
slug: 'src-features-onboarding-onboardingpage-tsx'
primary_target: 'src/features/onboarding/OnboardingPage.tsx'
related_targets: ['src/features/onboarding/OnboardingSteps.tsx']
---

# Onboarding (business setup)

Scope: the signed-in setup flow at /onboarding (BUSINESS_DETAILS → FINANCIAL_PREFERENCES → REVIEW), plus its loading, error and "set up" hold states. Mode: Operate.

Audience and job: a new OWNER sets up their store in a few minutes without accounting vocabulary. Six answers (name, what you sell, currency, time zone, financial-year start, low-balance warning), saved to the API on every Continue and resumable on any device. English and Bulgarian.

Constraints: preserve steps, order, validation, API calls, draft shape, resume and save behaviour. Industry stays free text: preset cards write their label as the industry string; "Other" opens a text field (user confirmed). Pinned identity: white work surface, ink, neutral greys, Geist; no colour accents, gradients, glass or decorative shadows.

## Direction contract

THESIS: Setup is a record being filled in. The rail is the business taking shape, answer by answer; the work area asks one step's questions as ruled blocks, each with the control that fits it. Refuses the centred wizard where every step is the same stack of identical fields.

OWN-WORLD: Montra monochrome. White work surface; sidebar-paper rail with a hairline edge; ink only for the current step tile, the selected mark in each group and the primary action. 10px controls, 12px option tiles, 1px hairlines between question blocks, Geist with tabular figures for money, months and clock times.

STORY: The owner sees where they are and what is left, understands what each answer changes in Montra (how money is written, when a day starts, which months a year covers, when a warning fires), watches their answers collect in the rail, checks them once on the review and creates the business.

FIRST VIEWPORT: From 1024px: a 300px rail at left (logo; steps 01–03 as numbered tiles, the current one ink, each with its questions and answered values beneath; language, account and sign out at the foot). Work area on white: question heading at 40px top-left of a 920px column, its description, then hairline-ruled blocks with a 240px question column beside the control. A sticky action bar at the foot carries save status, Back and the ink Continue. Under 1024px the rail becomes a header with a three-part step indicator.

FORM: Setup rail, position 5 of 7 on the ordered structure list. seed:46713f9288a8091d. Signature move: answers write themselves into the rail as they are given, and every question shows its consequence in place (the financial-year span, the local time, the warning sentence in the chosen currency).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
