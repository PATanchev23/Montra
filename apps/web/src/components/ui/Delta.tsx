import { ArrowDown, ArrowUp } from 'lucide-react';
import { useMessages } from '../../i18n';
import { common } from '../../i18n/common';
import { cn } from '../../lib/cn';
import { percent } from '../../lib/format';
import { changeKind } from './change';

/**
 * A relative change. Colour follows meaning, not direction: rising expenses
 * are bad, so callers pass `goodWhen="down"`. Pass the two amounts as well
 * as the ratio, so equal periods read "No change" and a period with nothing
 * before it reads "No earlier data", never NaN, Infinity or 0%.
 */
export function Delta({
  ratio,
  cents,
  previousCents,
  goodWhen = 'up',
  className,
}: {
  ratio: number | null;
  cents?: number;
  previousCents?: number;
  goodWhen?: 'up' | 'down';
  className?: string;
}) {
  const m = useMessages(common).delta;
  const kind = changeKind(ratio, cents, previousCents);
  if (kind !== 'ratio' || ratio === null) {
    // Neutral on purpose: no arrow, no green or red.
    return (
      <span className={cn('text-body-sm font-medium text-muted', className)}>
        {kind === 'none' ? m.noChange : m.noEarlier}
      </span>
    );
  }
  const up = ratio > 0;
  const flat = Math.abs(ratio) < 0.005;
  const good = flat ? null : up ? goodWhen === 'up' : goodWhen === 'down';
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        'tabular inline-flex items-center gap-0.5 text-body-sm font-medium',
        good === null ? 'text-muted' : good ? 'text-positive' : 'text-negative',
        className,
      )}
    >
      {!flat && <Icon className="size-3.5" strokeWidth={2.25} aria-hidden />}
      <span className="sr-only">{up ? m.up : m.down} </span>
      {percent(Math.abs(ratio))}
      {good !== null && <span className="sr-only">, {good ? m.good : m.bad}</span>}
    </span>
  );
}
