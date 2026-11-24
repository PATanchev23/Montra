import type { ReactNode } from 'react';
import type { CategoryId } from '../../demo/types';
import { cn } from '../../lib/cn';
import { CategoryIcon } from './CategoryIcon';

/**
 * One line in a compact money list: a quiet tile, two lines of text, the
 * figure and its date on the right. Lists rule the rows apart themselves
 * (`divide-y divide-line`).
 */
export function LedgerRow({
  categoryId,
  icon,
  title,
  subtitle,
  amount,
  meta,
  className,
}: {
  /** A sample-data category; or pass `icon` for anything else. */
  categoryId?: CategoryId;
  icon?: ReactNode;
  title: string;
  subtitle: ReactNode;
  amount: ReactNode;
  meta: ReactNode;
  className?: string;
}) {
  return (
    <li className={cn('flex items-center gap-4 py-3', className)}>
      {icon ?? (categoryId && <CategoryIcon categoryId={categoryId} />)}
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-medium text-ink" title={title}>
          {title}
        </p>
        <p className="truncate text-body-sm text-muted">{subtitle}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-body">{amount}</p>
        <p className="tabular text-body-sm text-muted">{meta}</p>
      </div>
    </li>
  );
}

export function LedgerSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ul aria-hidden className="divide-y divide-line">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-4 py-3">
          <span className="size-9 animate-pulse rounded-full bg-hover" />
          <span className="flex-1 space-y-2">
            <span className="block h-3.5 w-32 animate-pulse rounded bg-hover" />
            <span className="block h-3 w-20 animate-pulse rounded bg-hover" />
          </span>
          <span className="space-y-2">
            <span className="ml-auto block h-3.5 w-16 animate-pulse rounded bg-hover" />
            <span className="ml-auto block h-3 w-12 animate-pulse rounded bg-hover" />
          </span>
        </li>
      ))}
    </ul>
  );
}
