import { scaleLinear } from 'd3-scale';
import { motion } from 'motion/react';
import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { thousands } from '../../lib/format';
import { ChartTooltip } from './ChartTooltip';
import { useElementSize } from './useElementSize';

/*
 * Montra's signature chart: tall capsule bars with fully rounded ends.
 *
 *   layout="track"    one lavender series in front of slate-blue tracks that
 *                     run to the top of the scale (the Dashboard overview).
 *   layout="grouped"  two series side by side — lavender and slate — for
 *                     honest comparisons such as income vs. expenses.
 *
 * Projected categories render hatched with a dashed outline.
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

const MARGIN = { top: 12, right: 4, bottom: 30, left: 36 };

export function CapsuleBarChart({
  categories,
  series,
  layout = 'track',
  height = 260,
  formatTick = thousands,
  tickCount = 6,
  maxBarWidth = 54,
  renderTooltip,
  ariaLabel,
  className,
}: {
  categories: CapsuleCategory[];
  series: CapsuleSeries[];
  layout?: 'track' | 'grouped';
  height?: number;
  formatTick?: (value: number) => string;
  tickCount?: number;
  maxBarWidth?: number;
  renderTooltip?: (index: number) => ReactNode;
  ariaLabel: string;
  className?: string;
}) {
  const [ref, { width }] = useElementSize<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const patternId = useId();

  const drawn = layout === 'track' ? series.slice(0, 1) : series.slice(0, 2);
  const maxValue = Math.max(1, ...drawn.flatMap((s) => s.values));
  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotHeight = height - MARGIN.top - MARGIN.bottom;
  const baseline = MARGIN.top + plotHeight;

  const y = scaleLinear().domain([0, maxValue]).range([baseline, MARGIN.top]).nice(tickCount);
  const ticks = y.ticks(tickCount);
  const band = categories.length ? plotWidth / categories.length : 0;
  const barWidth =
    layout === 'track'
      ? Math.min(maxBarWidth, band * 0.8)
      : Math.min(maxBarWidth * 0.62, (band * 0.72) / 2);
  const gap = layout === 'grouped' ? Math.max(3, barWidth * 0.14) : 0;
  const radius = barWidth / 2;
  const trackTop = y(y.domain()[1]! * 0.955);
  // On narrow screens label every other bar; the hovered bar is always labelled.
  const labelEvery = band < 36 ? 2 : 1;

  function barGeometry(value: number) {
    if (value <= 0) return { top: baseline, h: 0 };
    const h = Math.max(baseline - y(value), barWidth);
    return { top: baseline - h, h };
  }

  function handleKey(event: KeyboardEvent) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const step = event.key === 'ArrowRight' ? 1 : -1;
      setActive((i) =>
        Math.min(
          categories.length - 1,
          Math.max(0, (i ?? (step > 0 ? -1 : categories.length)) + step),
        ),
      );
    } else if (event.key === 'Escape') {
      setActive(null);
    }
  }

  const tooltipTop =
    active !== null
      ? Math.min(
          ...drawn.map((s) => barGeometry(s.values[active] ?? 0).top),
          layout === 'track' ? trackTop : baseline,
        ) - 10
      : 0;

  return (
    <div ref={ref} className={cn('relative w-full select-none', className)} style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="group"
          aria-label={`${ariaLabel}. Use the left and right arrow keys to inspect each bar.`}
          tabIndex={0}
          onKeyDown={handleKey}
          onBlur={() => setActive(null)}
          onMouseLeave={() => setActive(null)}
          className="block overflow-visible rounded-md focus-visible:outline-offset-4"
        >
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
                <rect width="6" height="6" className={toneFill[tone]} fillOpacity={0.14} />
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="6"
                  className={toneStroke[tone]}
                  strokeWidth={2.2}
                  strokeOpacity={0.55}
                />
              </pattern>
            ))}
          </defs>

          {/* Grid + y axis */}
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={Math.round(y(tick)) + 0.5}
                y2={Math.round(y(tick)) + 0.5}
                className="stroke-grid"
                strokeDasharray={tick === 0 ? undefined : '2 5'}
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

          {categories.map((category, i) => {
            const center = MARGIN.left + band * i + band / 2;
            const dim = active !== null && active !== i;
            return (
              <g
                key={category.key}
                className="transition-opacity duration-200"
                opacity={dim ? 0.55 : 1}
                onMouseEnter={() => setActive(i)}
              >
                <rect
                  x={center - band / 2}
                  y={MARGIN.top}
                  width={band}
                  height={plotHeight}
                  fill="transparent"
                />

                {layout === 'track' && (
                  <rect
                    x={center - barWidth / 2}
                    y={trackTop}
                    width={barWidth}
                    height={baseline - trackTop}
                    rx={radius}
                    className="fill-chart-track"
                  />
                )}

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
                      initial={{ y: baseline, height: 0 }}
                      animate={{ y: top, height: h }}
                      transition={{ duration: 0.7, delay: 0.04 * i, ease: [0.22, 1, 0.36, 1] }}
                      className={projected ? toneStroke[s.tone] : toneFill[s.tone]}
                      fill={projected ? `url(#${patternId}-${s.tone})` : undefined}
                      strokeWidth={projected ? 1.25 : 0}
                      strokeDasharray={projected ? '3 3' : undefined}
                    />
                  );
                })}

                {(i % labelEvery === 0 || active === i) && (
                  <text
                    x={center}
                    y={height - 8}
                    textAnchor="middle"
                    className={cn(
                      'text-[12px]',
                      active === i ? 'fill-ink' : 'fill-muted',
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
      )}

      {active !== null && renderTooltip && (
        <ChartTooltip
          x={MARGIN.left + band * active + band / 2}
          y={tooltipTop}
          containerWidth={width}
        >
          {renderTooltip(active)}
        </ChartTooltip>
      )}

      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
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
                {c.projected ? ' (projected)' : ''}
              </th>
              {drawn.map((s) => (
                <td key={s.id}>{formatTick(s.values[i] ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
