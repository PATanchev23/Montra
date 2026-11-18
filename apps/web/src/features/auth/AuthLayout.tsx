import { scaleLinear, scaleTime } from 'd3-scale';
import { area, curveMonotoneX, line } from 'd3-shape';
import { eachMonthOfInterval, parseISO } from 'date-fns';
import { FlaskConical } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useId, type ReactNode } from 'react';
import { Outlet } from 'react-router';
import { DEMO_TODAY, useCashFlow } from '../../api/finance';
import { useElementSize } from '../../components/charts/useElementSize';
import { LanguageSwitch } from '../../components/LanguageSwitch';
import { Logo } from '../../components/Logo';
import { Delta } from '../../components/ui/Delta';
import { useMessages } from '../../i18n';
import { formatDate, formatDay, money } from '../../lib/format';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { authMessages } from './messages';

/* The month labels along the foot, and the room kept above the line for the date label. */
const LABEL_ROW = 28;
const PLOT_TOP = 28;
const ease = [0.22, 1, 0.36, 1] as const;

/*
 * How many actual weeks show before the projection. The form sits over the
 * right of the chart, so narrower windows show fewer past weeks and the
 * as-of marker always lands left of the form.
 */
function usePastWeeks() {
  const lg = useMediaQuery('(min-width: 64rem)');
  const xl = useMediaQuery('(min-width: 80rem)');
  const wide = useMediaQuery('(min-width: 90rem)');
  if (!lg || wide) return Number.POSITIVE_INFINITY;
  return xl ? 16 : 11;
}

/**
 * TechStore's weekly balance as one line across the page: solid while it is
 * history, dashed with its likely range once it is a projection, a marker on
 * the sample date between them. The same reading as the Cash flow page's
 * balance chart. Decorative here; the readout above it carries the figures.
 */
function ForecastGround({ className }: { className?: string }) {
  const { data } = useCashFlow();
  const reduceMotion = useReducedMotion();
  const m = useMessages(authMessages).layout;
  const gradientId = useId();
  const [ref, { width, height }] = useElementSize<HTMLDivElement>();
  const plotTop = PLOT_TOP;
  const pastWeeks = usePastWeeks();
  const all = data?.balance ?? [];
  const firstProjected = all.findIndex((p) => p.projected);
  const points = firstProjected > 0 ? all.slice(Math.max(0, firstProjected - pastWeeks)) : all;
  const split = points.findIndex((p) => p.projected);

  if (points.length < 2 || split < 1 || width === 0 || height === 0) {
    return <div ref={ref} aria-hidden className={className} />;
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
  const pad = (max - min) * 0.12 || 1;

  const x = scaleTime()
    .domain([parseISO(points[0]!.date), parseISO(end.date)])
    .range([8, width - 8]);
  const y = scaleLinear()
    .domain([min - pad, max + pad])
    .range([bottom, plotTop]);
  const at = (p: { date: string; balanceCents: number }) =>
    [x(parseISO(p.date)), y(p.balanceCents)] as [number, number];

  const curve = line().curve(curveMonotoneX);
  const history = curve(points.slice(0, split).map(at)) ?? '';
  const projection = curve(points.slice(split - 1).map(at)) ?? '';
  const fill = area().curve(curveMonotoneX).y0(bottom)(points.map(at)) ?? '';
  const range =
    area<(typeof points)[number]>()
      .curve(curveMonotoneX)
      .x((p) => x(parseISO(p.date)))
      .y0((p) => y(p.lowCents ?? p.balanceCents))
      .y1((p) => y(p.highCents ?? p.balanceCents))(points.slice(split - 1)) ?? '';
  const grid = y.ticks(4).filter((t) => y(t) >= plotTop && y(t) < bottom - 4);
  const months = eachMonthOfInterval({
    start: parseISO(points[0]!.date),
    end: parseISO(end.date),
  }).filter((month) => x(month) > 20 && x(month) < width - 20);
  const [asOfX, asOfY] = at(asOf);
  const [endX, endY] = at(end);
  const later = (delay: number) =>
    reduceMotion ? { duration: 0 } : { duration: 0.5, delay, ease };

  return (
    <div ref={ref} aria-hidden className={className}>
      <svg width={width} height={height} className="block overflow-visible text-chart-1">
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity={0.12} />
            <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>

        {grid.map((tick) => (
          <line
            key={tick}
            x1={0}
            x2={width}
            y1={Math.round(y(tick)) + 0.5}
            y2={Math.round(y(tick)) + 0.5}
            className="stroke-grid"
            strokeDasharray="2 5"
          />
        ))}
        <line x1={0} x2={width} y1={bottom + 0.5} y2={bottom + 0.5} className="stroke-line" />

        <motion.path
          d={fill}
          fill={`url(#${gradientId})`}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={later(0.3)}
        />
        <motion.path
          d={range}
          className="fill-chart-1"
          fillOpacity={0.08}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={later(0.8)}
        />

        <line x1={asOfX} x2={asOfX} y1={asOfY} y2={bottom} className="stroke-line-strong" />
        <text
          x={asOfX + 8}
          y={asOfY + 18}
          dy="0.32em"
          textAnchor="start"
          className="fill-muted text-caption"
        >
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
          className="fill-chart-1 stroke-canvas"
          strokeWidth={2}
        />
        <motion.circle
          cx={endX}
          cy={endY}
          r={4}
          className="fill-canvas stroke-chart-1"
          strokeWidth={2}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={later(1.2)}
        />

        {months.map((month) => (
          <text
            key={month.toISOString()}
            x={x(month)}
            y={height - 8}
            textAnchor="middle"
            className="tabular fill-muted text-caption"
          >
            {formatDay(month, 'MMM')}
          </text>
        ))}
      </svg>
    </div>
  );
}

/** The headline and the sentence under it. */
function ForecastStory({ className }: { className?: string }) {
  const m = useMessages(authMessages).layout;
  return (
    <section aria-labelledby="auth-story" className={className}>
      <h2
        id="auth-story"
        className="text-figure font-semibold tracking-[-0.03em] text-pretty text-ink sm:text-figure-xl"
      >
        {m.headline} <span className="xl:block">{m.headlineTail}</span>
      </h2>
      <p className="mt-5 max-w-[52ch] text-body-lg text-pretty text-ink-2 sm:text-figure-sm sm:font-normal sm:tracking-normal">
        {m.lead}
      </p>
    </section>
  );
}

/** The chart's header: the two figures it is drawn between, and how to read the line. */
function ForecastReadout({ className }: { className?: string }) {
  const m = useMessages(authMessages).layout;
  const { data } = useCashFlow();
  const now = data?.stats.closingCents;
  const ahead = data?.stats.projectedCents;
  const aheadDate = data?.balance.at(-1)?.date;
  const figure = (cents: number | undefined) =>
    cents === undefined ? (
      <span className="block h-[34px] w-36 animate-pulse rounded-control bg-hover sm:h-11 sm:w-48" />
    ) : (
      <span className="tabular block text-figure text-ink sm:text-figure-xl">
        {money(cents, { decimals: 0 })}
      </span>
    );

  return (
    <div className={className}>
      <dl className="flex flex-wrap gap-x-12 gap-y-5">
        <div>
          <dt className="text-body-sm text-ink-2 sm:text-body">
            {m.balanceOn(formatDay(DEMO_TODAY, 'd MMM'))}
          </dt>
          <dd className="mt-1">{figure(now)}</dd>
        </div>
        <div>
          <dt className="text-body-sm text-ink-2 sm:text-body">
            {aheadDate ? m.projectedBy(formatDate(aheadDate, 'd MMM')) : m.projected}
          </dt>
          <dd className="mt-1 flex items-baseline gap-2">
            {figure(ahead)}
            {now !== undefined && ahead !== undefined && <Delta ratio={(ahead - now) / now} />}
          </dd>
        </div>
      </dl>
      <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-caption text-muted">
        <span className="inline-flex items-center gap-1.5 font-medium text-ink-2">
          <FlaskConical aria-hidden className="size-3.5 shrink-0" strokeWidth={2} />
          {m.sample(formatDay(DEMO_TODAY, 'd MMM'))}
        </span>
        <span className="inline-flex items-center gap-4 whitespace-nowrap">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-chart-1" /> {m.actual}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-chart-1" /> {m.projected}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm bg-chart-1/10" /> {m.likelyRange}
          </span>
        </span>
      </p>
    </div>
  );
}

/**
 * The frame for signed-out pages: one continuous page, no cards. The logo and
 * language switch across the top; the headline at left and the form at right;
 * beneath them the chart's figures and the balance line, filling the rest of
 * the window edge to edge. The line runs on behind the form, which sits on a
 * plain plate that fades in at its left edge and out at its foot. The frame's
 * height comes from the window alone, so the chart never moves when the form
 * grows. Phones and tablets: the form first, then the headline, figures and
 * chart.
 */
export function AuthLayout({ children }: { children?: ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <div className="relative mx-auto grid w-full max-w-[1440px] grid-cols-1 px-4 pb-6 sm:px-6 lg:h-[max(100dvh,820px)] lg:grid-cols-[minmax(0,1fr)_400px] lg:grid-rows-[auto_auto_minmax(0,1fr)] lg:gap-x-20 lg:px-8 lg:pb-6 xl:px-12">
        <header className="flex h-18 items-center justify-between gap-4 lg:col-span-2">
          <Logo />
          <LanguageSwitch />
        </header>

        <main className="relative z-10 mx-auto mt-4 w-full max-w-[400px] sm:mt-8 lg:col-start-2 lg:row-span-2 lg:row-start-2 lg:mx-0 lg:mt-8 lg:self-start lg:before:absolute lg:before:-top-6 lg:before:-bottom-20 lg:before:-right-8 lg:before:-left-24 lg:before:-z-10 lg:before:bg-[linear-gradient(to_right,transparent,var(--canvas)_4rem)] lg:before:[mask-image:linear-gradient(to_bottom,black_calc(100%-3.5rem),transparent)]">
          {children ?? <Outlet />}
        </main>

        <ForecastStory className="mt-16 w-full lg:col-start-1 lg:row-start-2 lg:mt-8 lg:min-h-[309px]" />

        <section className="mt-10 flex w-full flex-col lg:col-span-2 lg:col-start-1 lg:row-start-3 lg:mt-0 lg:min-h-0">
          <ForecastReadout className="lg:absolute lg:top-[392px] lg:left-8 lg:z-10 lg:max-w-[calc(100%-400px-9rem)] xl:left-12" />
          <ForecastGround className="mt-6 h-56 sm:h-64 lg:mt-0 lg:h-auto lg:min-h-0 lg:flex-1" />
        </section>
      </div>
    </div>
  );
}

/** Title block shared by the auth pages. */
export function AuthHeading({ title, description }: { title: string; description: ReactNode }) {
  return (
    <header className="mb-7">
      <h1 className="text-figure font-semibold tracking-[-0.025em] text-balance text-ink sm:text-display">
        {title}
      </h1>
      <p className="mt-2 text-body text-pretty text-muted">{description}</p>
    </header>
  );
}

/** The quiet line under the form that switches between signing in and creating an account. */
export function AuthSwitch({ children }: { children: ReactNode }) {
  return <p className="mt-6 text-center text-body-sm text-muted">{children}</p>;
}
