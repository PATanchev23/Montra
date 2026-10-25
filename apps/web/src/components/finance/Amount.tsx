import type { EntryType } from '../../demo/types';
import { cn } from '../../lib/cn';
import { money, type MoneyOptions } from '../../lib/format';

/**
 * A signed money figure. Income reads teal with a plus; expenses read in a
 * restrained red with a minus — or neutral ink where colour would be noise.
 */
export function Amount({
  cents,
  type,
  decimals = 2,
  quietExpense = false,
  className,
}: {
  cents: number;
  type: EntryType;
  decimals?: MoneyOptions['decimals'];
  quietExpense?: boolean;
  className?: string;
}) {
  const signedCents = type === 'income' ? cents : -cents;
  return (
    <span
      className={cn(
        'tabular font-medium whitespace-nowrap',
        type === 'income' ? 'text-positive' : quietExpense ? 'text-ink' : 'text-negative',
        className,
      )}
    >
      {money(signedCents, { decimals, sign: 'always' })}
    </span>
  );
}
