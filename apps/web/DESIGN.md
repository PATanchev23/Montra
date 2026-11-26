---
name: Montra
description: Cash-flow management for small e-commerce businesses, set as a quiet monochrome ledger where the capsule chart is the one expressive form.
colors:
  canvas: '#f7f7f5'
  sidebar: '#f2f2ef'
  surface: '#ffffff'
  raised: '#ffffff'
  sunken: '#f3f3f0'
  hover: '#eeeeeb'
  line: '#e8e8e5'
  line-soft: '#f0f0ed'
  line-strong: '#d6d6d2'
  panel-line: '#e8e8e5'
  control: '#8c8c88'
  grid: '#eeeeeb'
  ink: '#171717'
  ink-2: '#454543'
  muted: '#6b6b68'
  faint: '#a3a3a0'
  accent: '#171717'
  accent-hover: '#333331'
  accent-ink: '#ffffff'
  accent-soft: '#eeeeeb'
  accent-line: '#cfcfcb'
  positive: '#17794b'
  positive-soft: '#e8f3ec'
  negative: '#c2352b'
  negative-soft: '#fbecea'
  warning: '#8a5a00'
  warning-soft: '#f6eedc'
  chart-1: '#252525'
  chart-track: '#e6e6e3'
  chart-2: '#858585'
  chart-3: '#555555'
  chart-4: '#a3a3a0'
  chart-5: '#c2c2be'
  chart-6: '#d9d9d5'
typography:
  display:
    fontFamily: 'Geist Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: '2rem'
    fontWeight: 600
    lineHeight: '2.375rem'
    letterSpacing: '-0.03em'
  figure:
    fontFamily: 'Geist Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1.75rem'
    fontWeight: 600
    lineHeight: '2.125rem'
    letterSpacing: '-0.025em'
    fontFeature: "'ss01', 'cv11', 'tnum', 'lnum'"
  figure-sm:
    fontFamily: 'Geist Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1.25rem'
    fontWeight: 600
    lineHeight: '1.75rem'
    letterSpacing: '-0.02em'
    fontFeature: "'ss01', 'cv11', 'tnum', 'lnum'"
  title:
    fontFamily: 'Geist Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1.0625rem'
    fontWeight: 600
    lineHeight: '1.5rem'
    letterSpacing: '-0.015em'
  body-lg:
    fontFamily: 'Geist Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.9375rem'
    fontWeight: 400
    lineHeight: '1.375rem'
  body:
    fontFamily: 'Geist Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: '1.375rem'
    fontFeature: "'ss01', 'cv11'"
  body-sm:
    fontFamily: 'Geist Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.8125rem'
    fontWeight: 400
    lineHeight: '1.25rem'
  caption:
    fontFamily: 'Geist Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.75rem'
    fontWeight: 400
    lineHeight: '1rem'
  mono:
    fontFamily: 'Geist Mono Variable, ui-monospace, SFMono-Regular, monospace'
    fontSize: '0.75rem'
    fontWeight: 400
    lineHeight: '1rem'
rounded:
  control: '10px'
  field: '12px'
  panel: '16px'
  pill: '9999px'
spacing:
  gutter-phone: '16px'
  gutter-tablet: '24px'
  gutter-desktop: '32px'
  gap-tight: '16px'
  gap: '24px'
  tile-pad-phone: '20px'
  panel-pad: '24px'
  content-max: '1440px'
  sidebar: '248px'
  rail: '76px'
components:
  button-primary:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.accent-ink}'
    rounded: '{rounded.control}'
    padding: '0 14px'
    height: '36px'
    typography: '{typography.body-sm}'
  button-primary-hover:
    backgroundColor: '{colors.accent-hover}'
    textColor: '{colors.accent-ink}'
  button-secondary:
    backgroundColor: '{colors.raised}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    padding: '0 14px'
    height: '36px'
  button-secondary-hover:
    backgroundColor: '{colors.hover}'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.muted}'
    rounded: '{rounded.control}'
    padding: '0 14px'
    height: '36px'
  button-ghost-hover:
    backgroundColor: '{colors.hover}'
    textColor: '{colors.ink}'
  panel:
    backgroundColor: '{colors.surface}'
    rounded: '{rounded.panel}'
    padding: '{spacing.panel-pad}'
  input:
    backgroundColor: '{colors.raised}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    padding: '0 12px'
    height: '36px'
    typography: '{typography.body-sm}'
  search-field-topbar:
    backgroundColor: '{colors.raised}'
    textColor: '{colors.ink}'
    rounded: '{rounded.field}'
    padding: '0 44px'
    height: '44px'
    typography: '{typography.body}'
  segmented-track:
    backgroundColor: '{colors.hover}'
    rounded: '{rounded.pill}'
    padding: '4px'
  segmented-item:
    textColor: '{colors.ink-2}'
    rounded: '{rounded.pill}'
    padding: '0 16px'
    height: '32px'
  segmented-item-active:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.accent-ink}'
  nav-item:
    textColor: '{colors.ink-2}'
    rounded: '{rounded.control}'
    padding: '0 14px'
    height: '44px'
    typography: '{typography.body}'
  nav-item-active:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.accent-ink}'
  badge-neutral:
    backgroundColor: '{colors.hover}'
    textColor: '{colors.ink-2}'
    rounded: '{rounded.pill}'
    padding: '0 8px'
    height: '22px'
  badge-positive:
    backgroundColor: '{colors.positive-soft}'
    textColor: '{colors.positive}'
    rounded: '{rounded.pill}'
  badge-negative:
    backgroundColor: '{colors.negative-soft}'
    textColor: '{colors.negative}'
    rounded: '{rounded.pill}'
  capsule-value:
    backgroundColor: '{colors.chart-1}'
    rounded: '{rounded.pill}'
  capsule-track:
    backgroundColor: '{colors.chart-track}'
    rounded: '{rounded.pill}'
  chart-tooltip:
    backgroundColor: '{colors.raised}'
    textColor: '{colors.ink-2}'
    rounded: '{rounded.field}'
    padding: '12px 14px'
---

# Design System: Montra

## Overview

**Creative North Star: "The Quiet Ledger Room"**

Montra is a monochrome room for reading money. Paper-white canvas, white panels held by a hairline and a whisper of shadow, ink for text, for the primary action and for the one navigation pill that says where you are. Nothing in the frame is coloured for decoration. The only expressive form is the capsule: tall pale tracks with ink capsules inside them, showing how full each period was. The same capsule shape returns in the segmented control, the badges and the active navigation pill, so the chart's vocabulary is the interface's vocabulary.

Density is calm rather than sparse. Figures lead at 600 weight with tabular lining numerals; labels and context sit beneath them in a two-step grey (ink-2 for secondary text, muted for metadata). Green and red are reserved for meaning: money in and money out, favourable and unfavourable change. Every other signal is carried by weight, position and the ink-on-paper contrast.

Light is the default theme. Dark is a selectable mirror that maps every role to neutral greys (no tint, no hue shift), and the `system` preference follows the OS. A `dark` preference saved before store version 1 cannot be told from the old dark default, so it is moved to light once; `light` and `system` were explicit choices and are kept. The rule lives in the UI store's migration and is repeated in the pre-paint script in `index.html` so there is no flash.

Coverage today: the dashboard and the shared shell (sidebar, rail, sheet, top bar, tab bar) are composed in this system. Every other page inherits the tokens and primitives but has not been recomposed, so some still carry patterns this system does not use (the uppercase page eyebrow, the generic empty-state card). Treat those as pending migration, not as precedent.

**Key Characteristics:**

- Black, white and neutral greys; green and red only for money direction and change.
- The capsule (fully rounded, never shorter than it is wide) as the signature form.
- Three radii: 10px controls, 12px larger fields and floating layers, 16px panels; pills for everything capsule-shaped.
- One panel surface, never nested; depth from a hairline plus a 4% shadow.
- Geist throughout; money in tabular figures at 600.
- Light default, neutral dark mirror, every text pair at WCAG 2.2 AA in both.

## Colors

A warm-neutral greyscale with ink at the top, two semantic hues held in reserve, and a grey ramp for data.

### Primary

- **Ledger Ink** (accent, same value as ink): primary buttons, the active navigation pill, the active segment, focus outlines, text selection and links. In dark it inverts to near-white with dark ink on top. Hover lifts to Graphite (accent-hover).
- **Pressed Ink** (chart-1): the value capsules and the largest share in the expense ring; a hair lighter than text ink so filled shapes do not out-shout the figures.

### Secondary

- **Ledger Green** (positive): money in, favourable change, positive badges. Its soft tint (positive-soft) backs badges only.
- **Ledger Red** (negative): money out, unfavourable change, errors, invalid field borders and their focus ring. Its soft tint backs badges and the error-state icon disc.

### Tertiary

- **Amber Notice** (warning) and its soft tint: status only, for a payment or limit that is close. It is not used in the dashboard body; it appears today as a notification dot in the top bar and on other pages' badges.

### Neutral

- **Paper Canvas** (canvas): the page behind everything; the top bar sits on it with no surface of its own.
- **Sidebar Paper** (sidebar): one step darker than canvas, the navigation plane.
- **Panel White** (surface) and **Raised White** (raised): panels, fields, menus, tooltips. Raised separates from surface only in dark.
- **Sunken Band** (sunken): grouping inside a panel (notes, the neutral transaction-type tile), never a second card.
- **Hover Grey** (hover, also accent-soft): hover fills, the segmented track, neutral badges, skeletons, avatar discs.
- **Hairlines** (line, line-soft, panel-line, line-strong): line for dividers and floating-layer borders, line-soft for the quietest row rules, panel-line for panel edges, line-strong for secondary button and bordered icon button edges.
- **Control Grey** (control): input and select boundaries; 3.38:1 on white so a field is findable without its label.
- **Grid Grey** (grid): chart gridlines.
- **Text greys**: ink (17.9:1 on white) for figures and titles, ink-2 (9.61:1 on white) for secondary text, muted (5.35:1 on white, 4.98:1 on canvas) for metadata and axis labels. Faint (2.53:1) is decorative only.
- **Data ramp** (chart-2 to chart-6): chart-2 is the second voice in grouped charts; chart-3, chart-2, chart-4, chart-5, chart-6 shade expense categories in rank order after chart-1. Chart-track is the pale capsule behind the values (12.26:1 against chart-1).

### Named Rules

**The Meaning-Only Colour Rule.** Green and red mean money in, money out, favourable and unfavourable. They never decorate, never tint an icon tile, never mark a category. Colour follows meaning, not direction: rising expenses read red.

**The One Ink Rule.** Ink fills exactly one navigation item (the page you are on), one segment per control and the primary action. A second ink-filled control in the same group means one of them is wrong.

**The Faint Is Not Text Rule.** Faint (#a3a3a0) fails text contrast; use it for placeholder glyphs only. Anything a reader must read uses muted or darker.

## Typography

**Display Font:** Geist Variable (with ui-sans-serif, system-ui)
**Body Font:** Geist Variable
**Label/Mono Font:** Geist Mono Variable, only for keyboard hints (the `/` key cap in the search field)

**Character:** One neutral grotesque at every level, sharpened with stylistic sets `ss01` and `cv11`. Hierarchy comes from weight and size, not from a second family.

### Hierarchy

- **Display** (600, 2rem, 2.375rem line, -0.03em): the page title, which on the dashboard is the greeting. Under 640px it steps to 1.625rem / 2rem.
- **Figure** (600, 1.75rem, -0.025em, tabular): the three summary figures.
- **Figure small** (600, 1.25rem, -0.02em, tabular): secondary figures inside panels.
- **Title** (600, 1.0625rem, -0.015em): every panel heading.
- **Body large** (400, 0.9375rem): the page description sentence under the title.
- **Body** (400, 0.875rem, 1.375rem line): navigation, tile labels, ledger row titles, the base text size.
- **Body small** (0.8125rem): panel descriptions, buttons, inputs, metadata lines, segmented labels.
- **Caption** (0.75rem, 1rem line): small segments, tooltip titles, chart scroll caption, account email; chart axis labels and tooltip rows use the same 12px.

### Named Rules

**The Tabular Money Rule.** Every amount, percentage, date range and axis tick is set with tabular lining figures (`tnum`, `lnum`), so columns align and changing values do not jitter.

**The Title Speaks Rule.** A page or panel opens with its title. No uppercase kicker or eyebrow line above it.

## Layout

The frame is a sidebar, a top bar on the canvas, and a content column capped at 1440px with 16px gutters on phones, 24px from 640px and 32px from 1024px.

- **Navigation by width.** At 1280px and up, a 248px sidebar (the reader can collapse it to the rail). From 1024 to 1279px, a 76px icon rail with labels in tooltips. From 640 to 1023px, no sidebar; the top bar opens the navigation as a left sheet. Under 640px, a fixed bottom tab bar (four destinations plus More, 64px targets, clear of the home indicator) and the content pads its foot to match.
- **Top bar.** 72px tall, on the canvas: a 44px search field up to 720px wide on every page (it finds pages, owner actions, budgets, categories and transactions; its results float beneath it as a 12px-cornered layer with the pop shadow, grouped under caption headings, matched letters in semibold ink; on phones a search button opens the same search full screen), a sample-data chip, the date-range menu and a 44px bordered notifications button.
- **Dashboard rhythm.** Sections stack with 16px gaps on phones and 24px from 640px. Summary tiles go three-up from 768px. The capsule chart sits beside a 320 to 352px breakdown rail from 1280px and stacks above it below that. The lower row pairs up from 768px and goes three-up (two flexible columns plus a 320 to 352px rail) only from the `wide` breakpoint (90rem, 1440px); in the paired layout the scenario panel spans both columns.
- **Panel padding.** 20px on phones, 24px from 640px.
- **One tile anatomy.** A summary tile keeps label and change on one line, the figure beneath, and the comparison line with its sparkline at the foot at every width; narrow tiles (under 18rem container width) drop the sparkline rather than rearrange.

## Elevation & Depth

A hybrid that is nearly flat. Surfaces separate from the canvas by tone and a hairline first; shadow only confirms it. Floating layers (menus, tooltips, popovers) are the one place a real shadow appears.

### Shadow Vocabulary

- **Panel whisper** (`box-shadow: 0 1px 2px rgb(23 23 23 / 0.04)`): every panel, the sidebar's business card. In dark, `0 1px 2px rgb(0 0 0 / 0.3)`.
- **Pop** (`box-shadow: 0 12px 32px -12px rgb(23 23 23 / 0.16), 0 2px 6px -2px rgb(23 23 23 / 0.06)`): menus, chart tooltips, other floating layers. In dark, `0 16px 40px -16px rgb(0 0 0 / 0.7), 0 2px 8px -2px rgb(0 0 0 / 0.45)`.
- **Overlay** (`rgb(23 23 23 / 0.32)`, dark `rgb(0 0 0 / 0.64)`): the scrim behind sheets.

### Named Rules

**The No-Nesting Rule.** Panels never nest. Inside a panel, group with spacing, dividers or a sunken band.

**The Floating-Only Shadow Rule.** Only content that floats over other content earns the pop shadow. Resting surfaces get the whisper or nothing.

## Shapes

Three corner sizes and the capsule. Controls (buttons, inputs, menu items, nav items, icon buttons, the transaction-type tile) are 10px. The larger 44px top-bar fields, the account trigger, the sidebar business card and chart tooltips are 12px. Panels and menus are 16px. Anything capsule-shaped is a full pill: segmented tracks and their indicator, badges, every chart bar, the tab-bar active marker, avatar and status discs. Borders are 1px throughout. Donut slices keep a 4px corner radius and a small pad angle between them.

## Components

### Buttons

Restrained and solid; one ink action per group.

- **Shape:** 10px corners; heights 32px (sm), 36px (md, default), 44px (lg).
- **Primary:** ink fill, white text, 500 weight; hover to Graphite.
- **Secondary (default variant):** raised white with a line-strong border; hover fills with hover grey and darkens the border to control grey.
- **Ghost:** muted text, no fill; hover fills hover grey and lifts text to ink.
- **Disabled:** 45% opacity, not-allowed cursor. The legacy `analytic` variant renders as primary.

### Chips / Badges

- **Style:** 22px full pills, 11px medium text, optional current-colour dot. Neutral is hover grey with ink-2 text; positive and negative use their soft tints with the full-strength hue as text.
- **Sample data label:** on panels fed by the sample layer, an ink-2 flask glyph and the text "Sample data · as of 25 Oct" sit on the header's description line, with a tooltip explaining the source. These panels show plain dates, never "today" or "in 3 days", because the sample layer's today is not the real date.

### Cards / Containers

- **Corner Style:** 16px.
- **Background:** surface white (dark: #171717).
- **Shadow Strategy:** panel whisper (see Elevation & Depth).
- **Border:** 1px panel-line.
- **Internal Padding:** 20px phones, 24px from 640px. Headers carry a 17px semibold title, an optional body-small muted description, and actions at right.

### Inputs / Fields

- **Style:** 36px tall, raised background, 1px control-grey border, 10px corners, body-small ink text, muted placeholder. Hover darkens the border to ink-2.
- **Top-bar search:** 44px, 12px corners, 18px leading glyph, body-size text, a mono `/` key cap at the trailing edge.
- **Focus:** border to accent and a 2px accent outline at 1px offset.
- **Error / Disabled:** invalid fields switch border and focus outline to negative; disabled at 55% opacity.

### Navigation

- **Sidebar:** 44px items with 18px line glyphs at 1.75 stroke, body text in ink-2; hover fills hover grey; the active item is the ink pill with white text. Primary destinations, then a rule, then system pages, then the business card and account menu at the foot. Collapsed, it is an icon rail with tooltips.
- **Bottom tab bar (under 640px):** five 64px cells with a 20px glyph over an 11px label; the active cell is ink text with a 2px ink capsule along its top edge; inactive is muted.
- **Segmented control:** a hover-grey pill track with 4px inset; the ink pill indicator glides between segments on a spring. 32px (md) or 28px (sm) segments.

### Capsule Bar Chart (signature)

The one expressive form. Each period is a pale track capsule running to the top of the scale with an ink capsule inside it showing the value, so every bar reads as how full that period was.

- **Geometry:** fully rounded ends; a capsule fills 76% of its band up to 44px wide; a nonzero value is never drawn shorter than the capsule is wide. Ticks follow a nice scale, thinned to every second line when it would exceed six. Gridlines in grid grey; axis labels 12px muted tabular.
- **Reading a period:** hover (mouse), tap, or Left / Right / Home / End. The active track darkens to line-strong, the active label turns ink semibold, and every other capsule steps back to 32% opacity over 200ms. A tooltip hangs from the top of the plot beside the period: to the right when 208px fit, else to the left, else pinned inside the chart against the edge farther from the period. It shows income, expenses and net together.
- **Pinning:** a click or key press pins the period until Escape, a second click on it, or focus leaving the chart. A pinned period is announced through a polite live region; the full data sits in a screen-reader table.
- **Focus:** the outline appears for keyboard focus only; pointer focus shows none.
- **Narrow charts:** under 480px wide, a capsule never goes below 12px; the plot scrolls sideways beside a fixed value axis, opens on the latest period, and shows the caption "Scroll sideways for earlier periods".
- **Motion:** capsules grow from the baseline over 550ms on the soft ease-out with a small stagger; switching the measure glides them to new heights. Reduced motion draws them in place.
- **Projected periods:** hatched fill with a dashed outline and an italic label.
- **Open decision:** the default 30-day view draws daily capsules about 16px wide at 1440px, well under the 44px cap. Whether the default should aggregate to weeks or stay daily is the user's call and is not settled here.

### States

Skeletons pulse in hover grey; the chart skeleton is a row of pill capsules. The error state is a negative-soft disc with a warning glyph and a retry button. The empty state is still the generic centred card (sunken disc, icon, title, body, action) inherited from the previous system; it has not been redesigned for this world.

### Expense Ring

A donut shaded by rank from ink down the grey ramp, with exact share and amount for each category beside it; each category links to its own expenses for the period.

### Ledger Row

A 36px sunken type tile with an ink-2 direction arrow, a body medium title over a muted subtitle, and the amount over a muted tabular date at right; rows divided by hairlines.

### Chart Tooltip

Raised white, 1px line border, 12px corners, pop shadow, 12px text. Title in caption semibold ink; rows with a small round swatch, muted label and ink-2 tabular value; the net row in semibold ink above a hairline.

## Do's and Don'ts

### Do:

- **Do** keep the frame monochrome: ink, white and the neutral greys carry every surface, control and chart.
- **Do** reserve positive and negative for money in, money out and favourable or unfavourable change, and let `goodWhen` decide the colour of a change, not its direction.
- **Do** draw bars as capsules: fully rounded ends, never shorter than their width, ink on a pale track.
- **Do** set every amount, percentage, date and tick in tabular lining figures.
- **Do** use 10px for controls, 12px for the large fields and floating readouts, 16px for panels, and full pills for capsule shapes.
- **Do** label any panel fed by sample data with "Sample data · as of [date]" and show plain dates on it.
- **Do** give every chart a keyboard path, a polite live region and a screen-reader table.
- **Do** keep text at muted (#6b6b68) or darker and input borders at control grey or darker.

### Don't:

- **Don't** introduce an accent hue: no teal, purple, gradient, glow or tinted icon tile anywhere.
- **Don't** nest panels or add a shadow to a resting surface beyond the panel whisper.
- **Don't** fill more than one navigation item, segment or primary action per group with ink.
- **Don't** set readable text in faint.
- **Don't** put an uppercase kicker or eyebrow above a page or panel title.
- **Don't** let a narrow chart squeeze capsules below 12px; scroll instead.
