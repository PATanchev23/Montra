import { scaleLinear, scaleTime } from 'd3-scale';
import { area, curveMonotoneX, line } from 'd3-shape';
import { eachMonthOfInterval, format, parseISO } from 'date-fns';
import { motion } from 'motion/react';
import {
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { cn } from '../../lib/cn';
import { thousands } from '../../lib/format';
import { ChartTooltip } from './ChartTooltip';
import { useElementSize } from './useElementSize';

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

  const dates = useMemo(
    () => [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort(),
    [series],
  );

  if (dates.length < 2) {
    return <div ref={ref} className={className} style={{ height }} />;
  }

  const first = parseISO(dates[0]!);
  const last = parseISO(dates.at(-1)!);
  const x = scaleTime()
    .domain([first, last])
    .range([MARGIN.left, Math.max(MARGIN.left + 1, width - MARGIN.right)]);

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
  const ticks = y.ticks(5);
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
          aria-label={`${ariaLabel}. Use the arrow keys to move through dates; hold Shift to jump a week.`}
          onPointerMove={handlePointer}
          onPointerLeave={() => setActiveIndex(null)}
          onKeyDown={handleKey}
          onBlur={() => setActiveIndex(null)}
          className="block overflow-visible rounded-md focus-visible:outline-offset-4"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.2} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>

          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={Math.round(y(tick)) + 0.5}
                y2={Math.round(y(tick)) + 0.5}
                className="stroke-grid"
                strokeDasharray="2 5"
              />
              <text
                x={MARGIN.left - 12}
                y={y(tick)}
                dy="0.32em"
                textAnchor="end"
                className="tabular fill-muted text-[11px]"
              >
                {formatTick(tick)}
              </text>
            </g>
          ))}

          {months.map((m) => (
            <text
              key={m.toISOString()}
              x={x(m)}
              y={height - 8}
              textAnchor="middle"
              className="fill-muted text-[12px]"
            >
              {format(m, 'MMM')}
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
              fillOpacity={0.1}
            />
          )}

          {threshold && (
            <g>
              <line
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={y(threshold.value)}
                y2={y(threshold.value)}
                className="stroke-negative"
                strokeOpacity={0.6}
                strokeDasharray="4 4"
              />
              <text
                x={width - MARGIN.right}
                y={y(threshold.value) - 6}
                textAnchor="end"
                className="fill-negative text-[11px]"
                fillOpacity={0.85}
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
                  <path
                    d={
                      area()
                        .curve(curveMonotoneX)
                        .y0(height - MARGIN.bottom)(all) ?? ''
                    }
                    fill={`url(#${gradientId})`}
                  />
                )}
                {actual.length > 1 && (
                  <motion.path
                    d={lineGen(actual.map(toXY)) ?? ''}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
                {projected.length > 1 && (
                  <motion.path
                    d={lineGen(projected.map(toXY)) ?? ''}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
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
