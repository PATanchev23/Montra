import { scaleLinear } from 'd3-scale';
import { motion, useReducedMotion } from 'motion/react';
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { cn } from '../../lib/cn';
import { thousands } from '../../lib/format';
import { ChartTooltip } from './ChartTooltip';
import { useElementSize } from './useElementSize';
import { useMessages } from '../../i18n';
import { common } from '../../i18n/common';

/*
 * Montra's signature chart: tall capsule bars with fully rounded ends.
 *
 *   layout="track"    one ink series in front of pale capsules that run to
 *                     the top of the scale, so each bar reads as "how full"
 *                     that period was (the Dashboard overview).
 *   layout="grouped"  two series side by side, ink and mid-grey, for honest
 *                     comparisons such as income vs. expenses.
 *
 * Projected categories render hatched with a dashed outline.
 *
 * A capsule never gets thinner than `minBarWidth`. When the plot cannot hold
 * every period at that width, it scrolls sideways beside a fixed value axis
 * and opens on the latest period.
 *
 * Reading a period: hover it, tap it, or step through with the arrow keys
 * (Home and End jump to the ends). The other capsules step back and the
 * period's values open beside it. A click or a key press pins the period
 * until Escape, a second click, or focus leaving the chart. Each pinned
 * period is announced through a polite live region, and the full data sits
 * in a screen-reader table.
 */

export interface CapsuleCategory {
  key: string;
  label: string;
  projected?: boolean;
}

export interface CapsuleSeries {
  id: string;
  label: string;
  values: number[];
  tone: 'primary' | 'secondary';
}

const toneFill = { primary: 'fill-chart-1', secondary: 'fill-chart-2' } as const;
const toneStroke = { primary: 'stroke-chart-1', secondary: 'stroke-chart-2' } as const;

const TOP = 8;
const BOTTOM = 32;
/** Room kept under a scrolling plot for its scrollbar and the note that says it scrolls. */
const SCROLLBAR = 24;
const TOOLTIP_WIDTH = 208;
/** Approximate width of one character of a 12px axis label. */
const CHAR = 6.6;
/** How much of its band a single capsule fills. */
const FILL = 0.76;

export function CapsuleBarChart({
  categories,
  series,
  layout = 'track',
  height: heightProp = 260,
  formatTick = thousands,
  formatValue = formatTick,
  tickCount = 5,
  maxBarWidth = 44,
  minBarWidth,
  renderTooltip,
  describe,
  ariaLabel,
  className,
}: {
  categories: CapsuleCategory[];
  series: CapsuleSeries[];
  layout?: 'track' | 'grouped';
  /** A fixed height in pixels, or `fill` to take the height of the element it sits in. */
  height?: number | 'fill';
  formatTick?: (value: number) => string;
  /** How values read in the screen-reader table; the axis format when omitted. */
  formatValue?: (value: number) => string;
  tickCount?: number;
  maxBarWidth?: number;
  /** The thinnest a track capsule may get before the plot scrolls. By default only charts under 480px wide scroll, at 12px. */
  minBarWidth?: number;
  renderTooltip?: (index: number) => ReactNode;
  /** One sentence for the live region when a period is pinned. */
  describe?: (index: number) => string;
  ariaLabel: string;
  className?: string;
}) {
  const [ref, size] = useElementSize<HTMLDivElement>();
  const plot = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  // A period under the pointer, and one pinned by a click or the keyboard.
  const [hovered, setHovered] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  // The focus ring is for keyboard use; a click or tap focuses the plot without it.
  const [keyFocus, setKeyFocus] = useState(false);
  const pointerFocus = useRef(false);
  const reduceMotion = useReducedMotion();
  const patternId = useId();

  const width = size.width;
  const outerHeight = heightProp === 'fill' ? size.height : heightProp;
  const count = categories.length;
  const active = hovered ?? (pinned !== null && pinned < count ? pinned : null);

  const drawn = layout === 'track' ? series.slice(0, 1) : series.slice(0, 2);
  const peak = Math.max(0, ...drawn.flatMap((s) => s.values));
  const maxValue = Math.max(1, peak);
  const y = scaleLinear().domain([0, maxValue]).nice(tickCount);
  let ticks = y.ticks(tickCount);
  // A nice scale can ask for eight or nine lines; every second one is plenty.
  if (ticks.length > 6) ticks = ticks.filter((_, i) => i % 2 === 0);
  // Nothing to scale: label the baseline only, not a column of fractions of a cent that all read 0.
  if (peak === 0) ticks = [0];
  const left = Math.max(28, 14 + Math.max(...ticks.map((t) => formatTick(t).length)) * CHAR);
  const plotWidth = Math.max(0, width - left);

  const floor = minBarWidth ?? (width >= 480 ? 0 : 12);
  const naturalBand = count ? plotWidth / count : 0;
  const minBand = layout === 'track' ? floor / FILL : 0;
  const scrolls = count > 0 && plotWidth > 0 && naturalBand < minBand;
  const band = scrolls ? minBand : naturalBand;
  const contentWidth = scrolls ? band * count : plotWidth;
  const height = Math.max(0, outerHeight - (scrolls ? SCROLLBAR : 0));
  const baseline = height - BOTTOM;
  y.range([baseline, TOP]);

  const barWidth = Math.max(
    2,
    layout === 'track'
      ? Math.min(maxBarWidth, band * FILL)
      : Math.min(maxBarWidth * 0.62, (band * 0.72) / 2),
  );
  const gap = layout === 'grouped' ? Math.max(2, barWidth * 0.14) : 0;
  const radius = barWidth / 2;

  // Each label needs its own width plus a gap; thin to every second, third …
  // label until neighbours cannot touch. The active period is always labelled.
  const longestLabel = Math.max(0, ...categories.map((c) => c.label.length));
  const labelRoom = longestLabel * CHAR + 12;
  const labelEvery = Math.max(1, Math.ceil(labelRoom / Math.max(band, 1)));

  // A scrolling plot opens on the latest period.
  useLayoutEffect(() => {
    const element = plot.current;
    if (!element || !scrolls) return;
    element.scrollLeft = element.scrollWidth;
    setScrollLeft(element.scrollLeft);
  }, [scrolls, count, contentWidth]);

  /** A capsule is never shorter than it is wide, so small values still read as one. */
  function barGeometry(value: number) {
    if (value <= 0) return { top: baseline, h: 0 };
    const h = Math.min(baseline - TOP, Math.max(baseline - y(value), barWidth));
    return { top: baseline - h, h };
  }

  function indexAt(event: MouseEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - box.left + event.currentTarget.scrollLeft;
    if (x < 0 || band === 0) return null;
    return Math.min(count - 1, Math.max(0, Math.floor(x / band)));
  }

  /** Scrolls a period into view when the keyboard moves to it. */
  function reveal(index: number) {
    const element = plot.current;
    if (!element || !scrolls) return;
    const start = band * index;
    if (start < element.scrollLeft) element.scrollLeft = start;
    else if (start + band > element.scrollLeft + element.clientWidth)
      element.scrollLeft = start + band - element.clientWidth;
  }

  function handleKey(event: KeyboardEvent) {
    const last = count - 1;
    let next: number | null | undefined;
    if (event.key === 'ArrowRight') next = pinned === null ? 0 : Math.min(last, pinned + 1);
    else if (event.key === 'ArrowLeft') next = pinned === null ? last : Math.max(0, pinned - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    else if (event.key === 'Escape') next = null;
    if (next === undefined) return;
    event.preventDefault();
    setKeyFocus(true);
    setHovered(null);
    setPinned(next);
    if (next !== null) reveal(next);
  }

  // The tooltip hangs beside the period from the top of the plot, so it
  // covers neither the chart's heading nor the capsule it describes. It opens
  // to the right when there is room, to the left otherwise. A pinned period that
  // has been scrolled out of view shows no tooltip.
  function tooltipPlacement(i: number) {
    const center = left + band * i + band / 2 - scrollLeft;
    if (center < left || center > width) return null;
    const clear = (layout === 'grouped' ? barWidth + gap / 2 : barWidth / 2) + 10;
    if (center + clear + TOOLTIP_WIDTH <= width)
      return { x: center + clear, y: TOP, side: 'right' as const };
    if (center - clear - TOOLTIP_WIDTH >= left)
      return { x: center - clear, y: TOP, side: 'left' as const };
    // Too narrow for either side: hold it inside the chart, against the edge
    // further from the period, so the chart's own heading and controls stay free.
    return center - left >= width - center
      ? { x: 0, y: TOP, side: 'right' as const }
      : { x: width, y: TOP, side: 'left' as const };
  }
  const placement = active !== null && renderTooltip ? tooltipPlacement(active) : null;

  const msg = useMessages(common);
  return (
    <div
      ref={ref}
      className={cn('relative w-full select-none', className)}
      style={{ height: heightProp === 'fill' ? '100%' : heightProp }}
    >
      {width > 0 && height > BOTTOM + TOP && (
        <>
          {/* The value axis stays put while the plot scrolls. */}
          <svg
            width={left}
            height={height}
            aria-hidden
            className="absolute top-0 left-0 block overflow-visible"
          >
            {ticks.map((tick) => (
              <text
                key={tick}
                x={left - 14}
                y={y(tick)}
                dy="0.32em"
                textAnchor="end"
                className="tabular fill-muted text-[12px]"
              >
                {formatTick(tick)}
              </text>
            ))}
          </svg>

          <div
            ref={plot}
            role="group"
            aria-label={`${ariaLabel}. ${msg.chart.periodKeys}`}
            tabIndex={0}
            onKeyDown={handleKey}
            onPointerDown={() => {
              pointerFocus.current = true;
            }}
            onFocus={() => setKeyFocus(!pointerFocus.current)}
            onBlur={() => {
              pointerFocus.current = false;
              setKeyFocus(false);
              setHovered(null);
              setPinned(null);
            }}
            onPointerMove={(e) => e.pointerType === 'mouse' && setHovered(indexAt(e))}
            onPointerLeave={() => setHovered(null)}
            onClick={(e) => {
              const index = indexAt(e);
              setPinned((current) => (current === index ? null : index));
            }}
            onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}
            className={cn(
              'absolute top-0 right-0 bottom-0 cursor-pointer touch-pan-x touch-pan-y overflow-y-hidden rounded-control',
              scrolls ? 'overflow-x-auto' : 'overflow-x-hidden',
              keyFocus ? 'outline-2 outline-offset-2 outline-accent' : 'outline-none',
            )}
            style={{ left }}
          >
            <svg width={contentWidth} height={height} aria-hidden className="block">
              <defs>
                {(['primary', 'secondary'] as const).map((tone) => (
                  <pattern
                    key={tone}
                    id={`${patternId}-${tone}`}
                    width="6"
                    height="6"
                    patternUnits="userSpaceOnUse"
                    patternTransform="rotate(45)"
                  >
                    <rect width="6" height="6" className={toneFill[tone]} fillOpacity={0.1} />
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="6"
                      className={toneStroke[tone]}
                      strokeWidth={2}
                      strokeOpacity={0.5}
                    />
                  </pattern>
                ))}
              </defs>

              {ticks.map((tick) => (
                <line
                  key={tick}
                  x1={0}
                  x2={contentWidth}
                  y1={Math.round(y(tick)) + 0.5}
                  y2={Math.round(y(tick)) + 0.5}
                  className="stroke-grid"
                />
              ))}

              {categories.map((category, i) => {
                const center = band * i + band / 2;
                const isActive = active === i;
                const stepBack = active !== null && !isActive;
                const labelled =
                  isActive ||
                  (i % labelEvery === 0 &&
                    (active === null || Math.abs(i - active) * band >= labelRoom));
                return (
                  <g key={category.key}>
                    {layout === 'track' && (
                      <rect
                        x={center - barWidth / 2}
                        y={TOP}
                        width={barWidth}
                        height={baseline - TOP}
                        rx={radius}
                        className={cn(
                          'transition-[fill] duration-200',
                          isActive ? 'fill-line-strong' : 'fill-chart-track',
                        )}
                      />
                    )}

                    <g
                      className="transition-opacity duration-200 ease-[var(--ease-out-soft)]"
                      opacity={stepBack ? 0.32 : 1}
                    >
                      {drawn.map((s, si) => {
                        const { top, h } = barGeometry(s.values[i] ?? 0);
                        const x =
                          layout === 'track'
                            ? center - barWidth / 2
                            : center - barWidth - gap / 2 + si * (barWidth + gap);
                        const projected = category.projected;
                        return (
                          <motion.rect
                            key={s.id}
                            x={x}
                            width={barWidth}
                            rx={radius}
                            initial={reduceMotion ? false : { y: baseline, height: 0 }}
                            animate={{ y: top, height: h }}
                            transition={
                              reduceMotion
                                ? { duration: 0 }
                                : {
                                    duration: 0.55,
                                    delay: Math.min(0.012 * i, 0.3),
                                    ease: [0.22, 1, 0.36, 1],
                                  }
                            }
                            className={projected ? toneStroke[s.tone] : toneFill[s.tone]}
                            fill={projected ? `url(#${patternId}-${s.tone})` : undefined}
                            strokeWidth={projected ? 1.25 : 0}
                            strokeDasharray={projected ? '3 3' : undefined}
                          />
                        );
                      })}
                    </g>

                    {labelled && (
                      <text
                        x={center}
                        y={height - 8}
                        textAnchor="middle"
                        className={cn(
                          'tabular text-[12px]',
                          isActive ? 'fill-ink font-semibold' : 'fill-muted',
                          category.projected && 'italic',
                        )}
                      >
                        {category.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </>
      )}

      {active !== null && placement && renderTooltip && (
        <ChartTooltip {...placement} containerWidth={width}>
          {renderTooltip(active)}
        </ChartTooltip>
      )}

      {scrolls && (
        <p className="absolute right-0 bottom-0 text-caption leading-4 text-muted" style={{ left }}>
          {msg.chart.scrollHint}
        </p>
      )}

      <p className="sr-only" aria-live="polite">
        {pinned !== null && pinned < count && describe ? describe(pinned) : ''}
      </p>

      {/* sr-only on a wrapper: a table grows to fit its rows whatever its own height. */}
      <div className="sr-only">
        <table>
          <caption>{ariaLabel}</caption>
          <thead>
            <tr>
              <th scope="col">{msg.chart.period}</th>
              {drawn.map((s) => (
                <th key={s.id} scope="col">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((c, i) => (
              <tr key={c.key}>
                <th scope="row">
                  {c.label}
                  {c.projected ? msg.chart.projected : ''}
                </th>
                {drawn.map((s) => (
                  <td key={s.id}>{formatValue(s.values[i] ?? 0)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
