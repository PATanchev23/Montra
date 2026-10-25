import { motion } from 'motion/react';
import { cn } from '../../lib/cn';

/**
 * Horizontal take on the capsule chart: a slate track with a rounded fill.
 * An optional pace marker shows where spending "should" be by today.
 */
export function CapsuleProgress({
  value,
  max,
  pace,
  size = 'md',
  tone,
  label,
}: {
  value: number;
  max: number;
  pace?: number;
  size?: 'sm' | 'md' | 'lg';
  /** Defaults to accent, warning above 90 %, negative when over. */
  tone?: 'accent' | 'warning' | 'negative' | 'analytic';
  label: string;
}) {
  const ratio = max > 0 ? value / max : 0;
  const resolved = tone ?? (ratio > 1 ? 'negative' : ratio >= 0.9 ? 'warning' : 'accent');
  const fill = {
    accent: 'bg-accent',
    warning: 'bg-warning',
    negative: 'bg-negative',
    analytic: 'bg-chart-1',
  }[resolved];
  const height = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-3.5' }[size];

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn('relative w-full rounded-full bg-chart-track', height)}
    >
      <motion.div
        className={cn('absolute inset-y-0 left-0 rounded-full', fill)}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(1, ratio) * 100}%` }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
      {pace !== undefined && max > 0 && pace < max && (
        <span
          aria-hidden
          className="absolute -top-1 -bottom-1 w-[2px] rounded-full bg-ink/70"
          style={{ left: `calc(${(pace / max) * 100}% - 1px)` }}
        />
      )}
    </div>
  );
}
