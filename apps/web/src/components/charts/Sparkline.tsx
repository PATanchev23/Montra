import { scaleLinear } from 'd3-scale';
import { curveMonotoneX, line } from 'd3-shape';
import { motion } from 'motion/react';
import { cn } from '../../lib/cn';

const tones = {
  positive: 'text-positive',
  negative: 'text-negative',
  analytic: 'text-chart-1',
  ink: 'text-ink',
  neutral: 'text-muted',
} as const;

export type SparkTone = keyof typeof tones;

/** A small, label-free trend line: one stroke, no fill. Dashed when it is a projection. */
export function Sparkline({
  values,
  tone = 'analytic',
  width = 72,
  height = 28,
  dashed = false,
  stretch = false,
  className,
}: {
  values: number[];
  tone?: SparkTone;
  width?: number;
  height?: number;
  dashed?: boolean;
  /** Fill whatever box the class gives it, instead of keeping the width:height shape. */
  stretch?: boolean;
  className?: string;
}) {
  if (values.length < 2) return null;
  const x = scaleLinear()
    .domain([0, values.length - 1])
    .range([1, width - 1]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const y = scaleLinear()
    .domain(min === max ? [min - 1, max + 1] : [min, max])
    .range([height - 2, 2]);
  const points = values.map((v, i) => [x(i), y(v)] as [number, number]);
  const path = line().curve(curveMonotoneX)(points) ?? '';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={stretch ? 'none' : undefined}
      aria-hidden
      className={cn('shrink-0 overflow-visible', tones[tone], className)}
    >
      {stretch ? (
        // Stretched, the line keeps its stroke weight on screen; a draw-in would measure
        // the path in the wrong units and break it into dashes, so it is drawn whole.
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={dashed ? '4 3' : undefined}
          vectorEffect="non-scaling-stroke"
        />
      ) : (
        <motion.path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={dashed ? '4 3' : undefined}
          initial={{ pathLength: dashed ? 1 : 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      )}
    </svg>
  );
}
