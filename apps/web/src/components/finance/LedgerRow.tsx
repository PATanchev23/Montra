import type { ReactNode } from 'react';
import type { CategoryId } from '../../demo/types';
import { cn } from '../../lib/cn';
import { CategoryIcon } from './CategoryIcon';

/** One line in a compact money list: icon, two lines of text, figure and meta on the right. */
export function LedgerRow({
  categoryId,
  title,
  subtitle,
  amount,
  meta,
  className,
}: {
  categoryId: CategoryId;
  title: ReactNode;
  subtitle: ReactNode;
  amount: ReactNode;
  meta: ReactNode;
  className?: string;
}) {
  return (
    <li
      className={cn(
        '-mx-2 flex items-center gap-3.5 rounded-control px-2 py-2.5 transition-colors hover:bg-hover/60',
        className,
      )}
    >
      <CategoryIcon categoryId={categoryId} />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[14px] text-ink">{title}</p>
        <p className="mt-1 truncate text-[12px] text-muted">{subtitle}</p>
      </div>
      <div className="shrink-0 text-right leading-tight">
        <p className="text-[14px]">{amount}</p>
        <p className="mt-1 text-[12px] text-muted">{meta}</p>
      </div>
    </li>
  );
}

export function LedgerSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ul aria-hidden className="flex flex-col">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-3.5 py-2.5">
          <span className="size-9 animate-pulse rounded-[10px] bg-hover" />
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
