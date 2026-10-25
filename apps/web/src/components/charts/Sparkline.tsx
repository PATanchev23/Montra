import { scaleLinear } from 'd3-scale';
import { area, curveMonotoneX, line } from 'd3-shape';
import { motion } from 'motion/react';
import { useId } from 'react';
import { cn } from '../../lib/cn';

const tones = {
  positive: 'text-positive',
  negative: 'text-negative',
  analytic: 'text-chart-1',
  neutral: 'text-muted',
} as const;

export type SparkTone = keyof typeof tones;

/** A small, label-free trend line with a soft fade beneath it. */
export function Sparkline({
  values,
  tone = 'analytic',
  width = 72,
  height = 28,
  dashed = false,
  className,
}: {
  values: number[];
  tone?: SparkTone;
  width?: number;
  height?: number;
  dashed?: boolean;
  className?: string;
}) {
  const gradientId = useId();
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
  const fill = area().curve(curveMonotoneX).y0(height)(points) ?? '';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      className={cn('shrink-0 overflow-visible', tones[tone], className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.22} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#${gradientId})`} />
      <motion.path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeDasharray={dashed ? '4 3' : undefined}
        initial={{ pathLength: dashed ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}
