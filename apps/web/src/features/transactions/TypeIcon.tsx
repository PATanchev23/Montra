import type { TransactionType } from '@montra/shared';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { cn } from '../../lib/cn';

/**
 * Money in or out, at a glance. Categories are free-form labels, so the icon
 * shows the direction rather than guessing at what a category means.
 */
export function TypeIcon({
  type,
  size = 'md',
  className,
}: {
  type: TransactionType;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const Icon = type === 'INCOME' ? ArrowDownLeft : ArrowUpRight;
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-[10px]',
        size === 'sm' ? 'size-8' : 'size-9',
        type === 'INCOME' ? 'bg-positive-soft text-positive' : 'bg-hover text-ink-2',
        className,
      )}
    >
      <Icon className={size === 'sm' ? 'size-4' : 'size-[18px]'} strokeWidth={1.75} />
    </span>
  );
}
