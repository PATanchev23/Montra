import { scaleLinear, scaleTime } from 'd3-scale';
import { area, curveMonotoneX, line } from 'd3-shape';
import { eachMonthOfInterval, parseISO } from 'date-fns';
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { Outlet } from 'react-router';
import { DEMO_TODAY, useCashFlow } from '../../api/finance';
import { useElementSize } from '../../components/charts/useElementSize';
import { LanguageSwitch } from '../../components/LanguageSwitch';
import { Logo } from '../../components/Logo';
import { Delta } from '../../components/ui/Delta';
import { useMessages } from '../../i18n';
import { formatDate, formatDay, money } from '../../lib/format';
import { authMessages } from './messages';

/* The month labels along the foot, and the room kept above the line. */
const LABEL_ROW = 32;
const PLOT_TOP = 12;
const ease = [0.22, 1, 0.36, 1] as const;

/**
 * TechStore's weekly balance as one line: solid while it is history, dashed
 * with its likely range once it is a projection, a marker on the sample date
 * between them. The same reading as the Cash flow page's balance chart.
 * Decorative here; the readout above it carries the figures.
 */
function ForecastChart({ className }: { className?: string }) {
  const { data } = useCashFlow();
  const reduceMotion = useReducedMotion();
  const m = useMessages(authMessages).layout;
  const [ref, { width, height }] = useElementSize<HTMLDivElement>();
  const points = data?.balance ?? [];
  const split = points.findIndex((p) => p.projected);

  if (points.length < 2 || split < 1 || width === 0 || height === 0) {
    return <div ref={ref} aria-hidden className={`relative ${className ?? ''}`} />;
  }

  const asOf = points[split - 1]!;
  const end = points.at(-1)!;
  const bottom = height - LABEL_ROW;
  const values = points.flatMap((p) => [
    p.balanceCents,
    p.lowCents ?? p.balanceCents,
    p.highCents ?? p.balanceCents,
  ]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.1 || 1;

  const x = scaleTime()
    .domain([parseISO(points[0]!.date), parseISO(end.date)])
    .range([2, width - 8]);
  const y = scaleLinear()
    .domain([min - pad, max + pad])
    .range([bottom, PLOT_TOP]);
  const at = (p: { date: string; balanceCents: number }) =>
    [x(parseISO(p.date)), y(p.balanceCents)] as [number, number];

  const curve = line().curve(curveMonotoneX);
  const history = curve(points.slice(0, split).map(at)) ?? '';
  const projection = curve(points.slice(split - 1).map(at)) ?? '';
  const range =
    area<(typeof points)[number]>()
      .curve(curveMonotoneX)
      .x((p) => x(parseISO(p.date)))
      .y0((p) => y(p.lowCents ?? p.balanceCents))
      .y1((p) => y(p.highCents ?? p.balanceCents))(points.slice(split - 1)) ?? '';
  const grid = y.ticks(3).filter((t) => y(t) > PLOT_TOP && y(t) < bottom - 8);
  const months = eachMonthOfInterval({
    start: parseISO(points[0]!.date),
    end: parseISO(end.date),
  }).filter((month) => x(month) >= 0 && x(month) <= width);
  const [asOfX, asOfY] = at(asOf);
  const [endX, endY] = at(end);
  const later = (delay: number) =>
    reduceMotion ? { duration: 0 } : { duration: 0.5, delay, ease };

  return (
    <div ref={ref} aria-hidden className={`relative ${className ?? ''}`}>
      {/* Out of flow, so the drawing never props its box open: the panel alone sizes the chart. */}
      <svg
        width={width}
        height={height}
        className="absolute inset-0 block overflow-visible text-chart-1"
      >
        {grid.map((tick) => (
          <line
            key={tick}
            x1={0}
            x2={width}
            y1={Math.round(y(tick)) + 0.5}
            y2={Math.round(y(tick)) + 0.5}
            className="stroke-line-strong"
            strokeDasharray="1 5"
            strokeLinecap="round"
          />
        ))}

        <motion.path
          d={range}
          className="fill-chart-1"
          fillOpacity={0.16}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={later(0.8)}
        />

        <line x1={asOfX} x2={asOfX} y1={asOfY} y2={bottom} className="stroke-line-strong" />
        <text x={asOfX + 10} y={bottom - 10} className="fill-muted text-[13px]">
          {m.asOf(formatDay(DEMO_TODAY, 'd MMM'))}
        </text>

        <motion.path
          d={history}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduceMotion ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 1.1, ease }}
        />
        <motion.path
          d={projection}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeDasharray="5 5"
          strokeLinecap="round"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={later(0.9)}
        />

        <circle
          cx={asOfX}
          cy={asOfY}
          r={4.5}
          className="fill-chart-1 stroke-[var(--auth-panel)]"
          strokeWidth={2}
        />
        <motion.circle
          cx={endX}
          cy={endY}
          r={5}
          className="fill-[var(--auth-panel)] stroke-chart-1"
          strokeWidth={2}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={later(1.2)}
        />

        {months.map((month) => (
          <text
            key={month.toISOString()}
            x={x(month)}
            y={height - 6}
            textAnchor="middle"
            className="tabular fill-muted text-[13px]"
          >
            {formatDay(month, 'MMM')}
          </text>
        ))}
      </svg>
    </div>
  );
}

/** The two figures the chart is drawn between. */
function ForecastFigures() {
  const m = useMessages(authMessages).layout;
  const { data } = useCashFlow();
  const now = data?.stats.closingCents;
  const ahead = data?.stats.projectedCents;
  const aheadDate = data?.balance.at(-1)?.date;
  const figure = (cents: number | undefined) =>
    cents === undefined ? (
      <span className="block h-11 w-44 animate-pulse rounded-control bg-hover" />
    ) : (
      <span className="tabular block text-figure text-ink sm:text-figure-xl">
        {money(cents, { decimals: 0 })}
      </span>
    );

  return (
    <dl className="flex flex-wrap gap-x-12 gap-y-5">
      <div>
        <dt className="text-body-sm text-ink-2">{m.balanceOn(formatDay(DEMO_TODAY, 'd MMM'))}</dt>
        <dd className="mt-1.5">{figure(now)}</dd>
      </div>
      <div>
        <dt className="text-body-sm text-ink-2">
          {aheadDate ? m.projectedBy(formatDate(aheadDate, 'd MMM')) : m.projected}
        </dt>
        <dd className="mt-1.5 flex items-baseline gap-2">
          {figure(ahead)}
          {now !== undefined && ahead !== undefined && (
            <Delta ratio={(ahead - now) / now} className="text-body-sm font-semibold" />
          )}
        </dd>
      </div>
    </dl>
  );
}

/** What the chart is, and how to read its line. */
function ForecastLegend() {
  const m = useMessages(authMessages).layout;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-body-sm text-muted">
      <span className="rounded-full bg-hover px-3 py-1.5 font-medium text-ink">{m.sample}</span>
      <span className="inline-flex items-center gap-2">
        <span className="h-0.5 w-5 rounded-full bg-chart-1" /> {m.actual}
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="w-5 border-t-2 border-dashed border-chart-1" /> {m.projected}
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-3 w-5 rounded-[3px] bg-chart-1/20" /> {m.likelyRange}
      </span>
    </div>
  );
}

/**
 * The forecast panel. It always wears the dark palette (the `dark` class scopes
 * the tokens inside it): an ink panel on the light page, and a raised charcoal
 * surface with a hairline edge on the dark page. Its height follows the window,
 * never the form, so the chart does not move when the form grows.
 */
function ForecastPanel({ className }: { className?: string }) {
  const m = useMessages(authMessages).layout;
  return (
    <section
      aria-labelledby="auth-story"
      className={`dark flex flex-col rounded-[24px] bg-[var(--auth-panel)] p-6 text-ink [--auth-panel:var(--sunken)] in-[.dark]:ring-1 in-[.dark]:ring-line in-[.dark]:[--auth-panel:var(--surface)] sm:p-10 xl:p-14 ${className ?? ''}`}
    >
      <h2
        id="auth-story"
        className="max-w-[500px] text-[2rem] leading-[1.08] font-semibold tracking-[-0.035em] text-pretty text-ink sm:text-[2.875rem]"
      >
        {m.headline} {m.headlineTail}
      </h2>
      <p className="mt-5 max-w-[48ch] text-body-lg text-pretty text-ink-2 sm:text-[1.0625rem] sm:leading-7">
        {m.lead}
      </p>

      <div className="mt-10 xl:mt-12">
        <ForecastFigures />
      </div>
      <div className="mt-10 xl:mt-14">
        <ForecastLegend />
      </div>
      <ForecastChart className="mt-6 h-56 sm:h-64 lg:h-auto lg:min-h-[200px] lg:flex-1" />
    </section>
  );
}

/**
 * The frame for signed-out pages, after design/Sign in@1x.png. Wide screens:
 * the form column at left on the page canvas (logo and language switch at its
 * head, the form centred, the product line at its foot) and the dark forecast
 * panel filling the right of the window. Phones and tablets: the form first,
 * then the forecast panel.
 */
export function AuthLayout({ children }: { children?: ReactNode }) {
  const m = useMessages(authMessages).layout;
  return (
    <div className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.22fr)] xl:grid-cols-[640px_minmax(0,1fr)]">
      <div className="flex flex-col px-5 pt-5 pb-8 sm:px-10 lg:min-h-dvh lg:px-14 lg:pt-6 xl:px-[72px]">
        <header className="flex h-12 items-center justify-between gap-4">
          <Logo />
          <LanguageSwitch />
        </header>

        <main className="mx-auto mt-12 w-full max-w-[400px] lg:my-auto lg:py-12">
          {children ?? <Outlet />}
        </main>

        <p className="hidden text-body-sm text-ink-2 lg:block">{m.footer}</p>
      </div>

      <ForecastPanel className="mx-3 mb-3 sm:mx-6 sm:mb-6 lg:mx-0 lg:my-4 lg:mr-4 lg:min-h-[calc(100dvh-2rem)]" />
      <p className="px-5 pb-8 text-body-sm text-ink-2 sm:px-10 lg:hidden">{m.footer}</p>
    </div>
  );
}

/** Title block shared by the auth pages. */
export function AuthHeading({ title, description }: { title: string; description: ReactNode }) {
  return (
    <header className="mb-9">
      <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-[-0.03em] text-balance text-ink sm:text-[2.25rem]">
        {title}
      </h1>
      <p className="mt-3 text-body-lg text-pretty text-muted sm:text-base">{description}</p>
    </header>
  );
}

/** The line under the form that switches between signing in and creating an account. */
export function AuthSwitch({ children }: { children: ReactNode }) {
  return <p className="mt-6 text-center text-body-lg text-ink-2">{children}</p>;
}
