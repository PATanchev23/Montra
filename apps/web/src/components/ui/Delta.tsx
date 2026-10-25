import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '../../lib/cn';
import { percent } from '../../lib/format';

/**
 * A relative change. Colour follows meaning, not direction: rising expenses
 * are bad, so callers pass `goodWhen="down"`.
 */
export function Delta({
  ratio,
  goodWhen = 'up',
  className,
}: {
  ratio: number | null;
  goodWhen?: 'up' | 'down';
  className?: string;
}) {
  if (ratio === null || !Number.isFinite(ratio)) {
    return <span className={cn('text-[13px] text-faint', className)}>—</span>;
  }
  const up = ratio > 0;
  const flat = Math.abs(ratio) < 0.005;
  const good = flat ? null : up ? goodWhen === 'up' : goodWhen === 'down';
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        'tabular inline-flex items-center gap-0.5 text-[13px] font-medium',
        good === null ? 'text-muted' : good ? 'text-positive' : 'text-negative',
        className,
      )}
    >
      {!flat && <Icon className="size-3.5" strokeWidth={2.25} aria-hidden />}
      <span className="sr-only">{up ? 'Up' : 'Down'} </span>
      {percent(Math.abs(ratio))}
    </span>
  );
}
