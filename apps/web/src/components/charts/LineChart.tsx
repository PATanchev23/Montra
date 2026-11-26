import { scaleLinear, scaleTime } from 'd3-scale';
import { area, curveMonotoneX, line } from 'd3-shape';
import { eachMonthOfInterval, parseISO } from 'date-fns';
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion } from 'motion/react';
import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { cn } from '../../lib/cn';
import { ChartTooltip } from './ChartTooltip';
import { useElementSize } from './useElementSize';
import { useMessages } from '../../i18n';
import { common } from '../../i18n/common';
import { formatDay, thousands } from '../../lib/format';

/*
 * Time-series line chart for balances and projections. Shares the capsule
 * chart's axes, grid and tooltip so the two read as one system. Points
 * flagged `projected` are drawn dashed, continuing from the last actual point.
 */

export interface LinePoint {
  date: string;
  value: number;
  projected?: boolean;
}

/** A labelled point on the line: a ring with a short label above or below it, or a solid "you are here" dot. */
export interface LineCallout {
  date: string;
  value: number;
  label?: string;
  below?: boolean;
  solid?: boolean;
}

export interface LineSeries {
  id: string;
  label: string;
  points: LinePoint[];
  tone: 'primary' | 'secondary' | 'accent';
  area?: boolean;
}

const toneClass = {
  primary: 'text-chart-1',
  secondary: 'text-chart-2',
  accent: 'text-accent',
} as const;

const MARGIN = { top: 16, right: 8, bottom: 30, left: 40 };
/** The detailed chart keeps room above the plot for the marker pills. */
const DETAILED_TOP = 40;
/** The gap between a value label and the plot, and the width of one 11px label character. */
const TICK_GAP = 12;
const TICK_CHAR = 6.2;

/** How the chart moves to new figures: quick to leave, gentle to land. */
const MORPH = { duration: 0.45, ease: [0.22, 1, 0.36, 1] } as const;

/**
 * A value that glides to its target when the figures change (`dataKey`), and
 * follows at once for anything else, such as the chart being resized.
 */
function useMorph<T extends string | number>(target: T, dataKey: string) {
  const value = useMotionValue(target);
  const reduceMotion = useReducedMotion();
  const lastKey = useRef(dataKey);
  useLayoutEffect(() => {
    const dataChanged = lastKey.current !== dataKey;
    lastKey.current = dataKey;
    if (!dataChanged || reduceMotion) {
      value.set(target);
      return;
    }
    const controls = animate(value, target, MORPH);
    return () => controls.stop();
  }, [target, dataKey, value, reduceMotion]);
  return value;
}

/** A path that reshapes itself into the new figures rather than jumping to them. */
function MorphPath({
  d,
  dataKey,
  ...props
}: { d: string; dataKey: string } & Omit<ComponentProps<typeof motion.path>, 'd'>) {
  const shape = useMorph(d, dataKey);
  return <motion.path d={shape} {...props} />;
}

export function LineChart({
  series,
  band,
  height = 260,
  formatTick = thousands,
  markers = [],
  threshold,
  renderTooltip,
  ariaLabel,
  className,
  detailed = false,
  callouts = [],
}: {
  series: LineSeries[];
  band?: { date: string; low: number; high: number }[];
  height?: number;
  formatTick?: (value: number) => string;
  markers?: { date: string; label: string }[];
  threshold?: { value: number; label: string };
  renderTooltip?: (date: string) => ReactNode;
  ariaLabel: string;
  className?: string;
  /**
   * The full reading for a page that is about this line: history fades into
   * the canvas, markers become ink pills above the plot, and the ground under
   * a threshold is shaded as the place the balance should not go.
   */
  detailed?: boolean;
  callouts?: LineCallout[];
}) {
  const [ref, { width }] = useElementSize<HTMLDivElement>();
  const top = detailed ? DETAILED_TOP : MARGIN.top;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const gradientId = useId();
  const msg = useMessages(common);

  const dates = useMemo(
    () => [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort(),
    [series],
  );
  // Changes only when the figures do, so the lines morph between data sets but not on resize.
  const dataKey = useMemo(
    () => series.map((s) => s.points.map((p) => `${p.date}:${p.value}`).join()).join('|'),
    [series],
  );

  if (dates.length < 2) {
    return <div ref={ref} className={className} style={{ height }} />;
  }

  const first = parseISO(dates[0]!);
  const last = parseISO(dates.at(-1)!);
  const values = [
    ...series.flatMap((s) => s.points.map((p) => p.value)),
    ...(band ?? []).flatMap((b) => [b.low, b.high]),
    ...(threshold ? [threshold.value] : []),
  ];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.08 || 1;
  const y = scaleLinear()
    .domain([Math.min(0, min - pad) < 0 && min >= 0 ? 0 : min - pad, max + pad])
    .range([height - MARGIN.bottom, top])
    .nice(5);
  // Nothing to scale: label the baseline only, not a column of fractions that all read 0.
  const ticks = min === 0 && max === 0 ? [0] : y.ticks(4);
  // The value labels get the room their longest label needs ("30 хил." is wider than "30k").
  const left = Math.max(
    MARGIN.left,
    TICK_GAP + 4 + Math.max(...ticks.map((t) => formatTick(t).length)) * TICK_CHAR,
  );
  const x = scaleTime()
    .domain([first, last])
    .range([left, Math.max(left + 1, width - MARGIN.right)]);
  const months = eachMonthOfInterval({ start: first, end: last }).filter((m) => m >= first);

  const toXY = (p: LinePoint) => [x(parseISO(p.date)), y(p.value)] as [number, number];
  const lineGen = line().curve(curveMonotoneX);

  const activeDate = activeIndex !== null ? dates[activeIndex]! : null;

  function handlePointer(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const time = x.invert(event.clientX - box.left).getTime();
    let best = 0;
    let bestDistance = Infinity;
    dates.forEach((d, i) => {
      const distance = Math.abs(parseISO(d).getTime() - time);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    setActiveIndex(best);
  }

  function handleKey(event: KeyboardEvent) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step) {
      event.preventDefault();
      const jump = event.shiftKey ? 7 : 1;
      setActiveIndex((i) =>
        Math.min(dates.length - 1, Math.max(0, (i ?? dates.length - 1) + step * jump)),
      );
    } else if (event.key === 'Escape') {
      setActiveIndex(null);
    }
  }

  const activeX = activeDate ? x(parseISO(activeDate)) : 0;
  const activeTop = activeDate
    ? Math.min(
        ...series.map((s) => {
          const p = s.points.find((point) => point.date === activeDate);
          return p ? y(p.value) : height;
        }),
      )
    : 0;

  return (
    <div ref={ref} className={cn('relative w-full select-none', className)} style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="group"
          tabIndex={0}
          aria-label={`${ariaLabel}. ${msg.chart.keyboardHint}`}
          onPointerMove={handlePointer}
          onPointerLeave={() => setActiveIndex(null)}
          onKeyDown={handleKey}
          onBlur={() => setActiveIndex(null)}
          className="block overflow-visible rounded-md focus-visible:outline-offset-4"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={detailed ? 0.11 : 0.04} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={detailed ? 0 : 0.04} />
            </linearGradient>
          </defs>

          {/* Tick labels slide to where the new scale puts them; ones the scale gains or loses fade. Only zero gets a line. */}
          <AnimatePresence initial={false}>
            {ticks.map((tick) => (
              <motion.g
                key={tick}
                initial={{ opacity: 0, y: Math.round(y(tick)) }}
                animate={{ opacity: 1, y: Math.round(y(tick)) }}
                exit={{ opacity: 0 }}
                transition={MORPH}
              >
                {tick === 0 && (
                  <line
                    x1={left}
                    x2={width - MARGIN.right}
                    y1={0.5}
                    y2={0.5}
                    className="stroke-line"
                  />
                )}
                <text
                  x={left - TICK_GAP}
                  y={0}
                  dy="0.32em"
                  textAnchor="end"
                  className="tabular fill-muted text-[11px]"
                >
                  {formatTick(tick)}
                </text>
              </motion.g>
            ))}
          </AnimatePresence>

          {months.map((m) => (
            <text
              key={m.toISOString()}
              x={x(m)}
              y={height - 8}
              textAnchor="middle"
              className="fill-muted text-[12px]"
            >
              {formatDay(m, 'MMM')}
            </text>
          ))}

          {band && band.length > 1 && (
            <path
              d={
                area<{ date: string; low: number; high: number }>()
                  .curve(curveMonotoneX)
                  .x((b) => x(parseISO(b.date)))
                  .y0((b) => y(b.low))
                  .y1((b) => y(b.high))(band) ?? ''
              }
              className="fill-chart-1"
              fillOpacity={0.06}
            />
          )}

          {threshold && (
            <g>
              {/* Below the warning level is ground the balance should not reach. */}
              {detailed && y(threshold.value) < height - MARGIN.bottom && (
                <rect
                  x={left}
                  y={y(threshold.value)}
                  width={Math.max(0, width - MARGIN.right - left)}
                  height={height - MARGIN.bottom - y(threshold.value)}
                  className="fill-negative"
                  fillOpacity={0.06}
                />
              )}
              <line
                x1={left}
                x2={width - MARGIN.right}
                y1={y(threshold.value)}
                y2={y(threshold.value)}
                className={detailed ? 'stroke-negative' : 'stroke-control'}
                strokeOpacity={detailed ? 0.55 : 1}
                strokeDasharray="3 4"
              />
              <text
                x={width - MARGIN.right}
                y={y(threshold.value) - 6}
                textAnchor="end"
                className="fill-muted text-[11px]"
              >
                {threshold.label}
              </text>
            </g>
          )}

          {markers.map((marker) => {
            if (!detailed) return null;
            const mx = x(parseISO(marker.date));
            const pill = marker.label.length * 6.3 + 18;
            return (
              <g key={marker.date}>
                <line
                  x1={mx}
                  x2={mx}
                  y1={top - 12}
                  y2={height - MARGIN.bottom}
                  className="stroke-line-strong"
                  strokeDasharray="2 3"
                />
                <rect
                  x={mx - pill / 2}
                  y={4}
                  width={pill}
                  height={22}
                  rx={11}
                  className="fill-accent"
                />
                <text
                  x={mx}
                  y={15}
                  dy="0.35em"
                  textAnchor="middle"
                  className="fill-accent-ink text-[11px] font-medium"
                >
                  {marker.label}
                </text>
              </g>
            );
          })}

          {!detailed &&
            markers.map((marker) => (
              <g key={marker.date}>
                <line
                  x1={x(parseISO(marker.date))}
                  x2={x(parseISO(marker.date))}
                  y1={top - 4}
                  y2={height - MARGIN.bottom}
                  className="stroke-line-strong"
                />
                <text
                  x={x(parseISO(marker.date)) + 6}
                  y={top + 6}
                  className="fill-muted text-[11px] font-medium"
                >
                  {marker.label}
                </text>
              </g>
            ))}

          {series.map((s) => {
            const actual = s.points.filter((p) => !p.projected);
            const firstProjected = s.points.findIndex((p) => p.projected);
            const projected =
              firstProjected === -1 ? [] : s.points.slice(Math.max(0, firstProjected - 1));
            const all = s.points.map(toXY);
            return (
              <g key={s.id} className={toneClass[s.tone]}>
                {s.area && (
                  <MorphPath
                    dataKey={dataKey}
                    d={
                      area()
                        .curve(curveMonotoneX)
                        // The detailed chart fills what happened; the projection keeps only its range.
                        .y0(height - MARGIN.bottom)(
                        detailed && actual.length > 1 ? actual.map(toXY) : all,
                      ) ?? ''
                    }
                    fill={`url(#${gradientId})`}
                  />
                )}
                {actual.length > 1 && (
                  <MorphPath
                    dataKey={dataKey}
                    d={lineGen(actual.map(toXY)) ?? ''}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={detailed ? 2 : 1.75}
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
                {projected.length > 1 && (
                  <MorphPath
                    dataKey={dataKey}
                    d={lineGen(projected.map(toXY)) ?? ''}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={detailed ? 2 : 1.75}
                    strokeDasharray="5 5"
                    strokeLinecap="round"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: actual.length > 1 ? 0.7 : 0 }}
                  />
                )}
              </g>
            );
          })}

          {callouts.map((c) => {
            const cx = x(parseISO(c.date));
            const cy = y(c.value);
            const nearEnd = cx > width - MARGIN.right - 70;
            return (
              <g key={`${c.date}-${c.label ?? ''}`} pointerEvents="none">
                <circle
                  cx={cx}
                  cy={cy}
                  r={c.solid ? 5 : 4.5}
                  strokeWidth={c.solid ? 3 : 2}
                  className={
                    c.solid ? 'fill-chart-1 stroke-surface' : 'fill-surface stroke-chart-1'
                  }
                />
                {c.label && (
                  <text
                    // Below a point, the label leans right, clear of the line arriving from the left.
                    x={nearEnd ? cx - 2 : c.below ? cx + 4 : cx}
                    y={c.below ? cy + 21 : cy - 13}
                    textAnchor={nearEnd ? 'end' : c.below ? 'start' : 'middle'}
                    // A halo in the panel colour keeps the label legible over the line and its range.
                    className="tabular fill-ink stroke-surface text-[11.5px] font-semibold [paint-order:stroke]"
                    strokeWidth={4}
                    strokeLinejoin="round"
                  >
                    {c.label}
                  </text>
                )}
              </g>
            );
          })}

          {activeDate && (
            <g pointerEvents="none">
              <line
                x1={activeX}
                x2={activeX}
                y1={top}
                y2={height - MARGIN.bottom}
                className="stroke-line-strong"
              />
              {series.map((s) => {
                const p = s.points.find((point) => point.date === activeDate);
                if (!p) return null;
                return (
                  <circle
                    key={s.id}
                    cx={activeX}
                    cy={y(p.value)}
                    r={4.5}
                    strokeWidth={2.5}
                    className={cn('fill-surface stroke-current', toneClass[s.tone])}
                  />
                );
              })}
            </g>
          )}
        </svg>
      )}

      {activeDate && renderTooltip && (
        <ChartTooltip x={activeX} y={activeTop - 14} containerWidth={width}>
          {renderTooltip(activeDate)}
        </ChartTooltip>
      )}
    </div>
  );
}
