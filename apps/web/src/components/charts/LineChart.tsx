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
}) {
  const [ref, { width }] = useElementSize<HTMLDivElement>();
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
    .range([height - MARGIN.bottom, MARGIN.top])
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
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.04} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0.04} />
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
              <line
                x1={left}
                x2={width - MARGIN.right}
                y1={y(threshold.value)}
                y2={y(threshold.value)}
                className="stroke-control"
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

          {markers.map((marker) => (
            <g key={marker.date}>
              <line
                x1={x(parseISO(marker.date))}
                x2={x(parseISO(marker.date))}
                y1={MARGIN.top - 4}
                y2={height - MARGIN.bottom}
                className="stroke-line-strong"
              />
              <text
                x={x(parseISO(marker.date)) + 6}
                y={MARGIN.top + 6}
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
                        .y0(height - MARGIN.bottom)(all) ?? ''
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
                    strokeWidth={1.75}
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
                    strokeWidth={1.75}
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

          {activeDate && (
            <g pointerEvents="none">
              <line
                x1={activeX}
                x2={activeX}
                y1={MARGIN.top}
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
