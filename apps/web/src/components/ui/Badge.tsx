import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type Tone = 'neutral' | 'positive' | 'negative' | 'warning' | 'accent' | 'analytic';

const tones: Record<Tone, string> = {
  neutral: 'bg-hover text-ink-2',
  positive: 'bg-positive-soft text-positive',
  negative: 'bg-negative-soft text-negative',
  warning: 'bg-warning-soft text-warning',
  accent: 'bg-accent-soft text-accent',
  analytic: 'bg-chart-1-soft text-chart-1',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
  dot,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full px-2 text-[11px] font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
