import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * Floating readout shared by every chart. By default the chart supplies an
 * anchor point and the tooltip sits above it, flipping its alignment near the
 * edges. With `side`, it hangs from (x, y) beside the anchor instead, so a
 * chart can keep it inside its own plot, clear of headings above the chart.
 */
export function ChartTooltip({
  x,
  y,
  containerWidth,
  side,
  children,
}: {
  x: number;
  y: number;
  containerWidth: number;
  /** Which side of x the tooltip opens towards, with (x, y) as its top corner. */
  side?: 'left' | 'right';
  children: ReactNode;
}) {
  const align = x < 110 ? 'left' : x > containerWidth - 110 ? 'right' : 'center';
  return (
    <div
      role="presentation"
      className={cn(
        'pointer-events-none absolute z-10 min-w-44 rounded-field bg-raised px-3.5 py-3 whitespace-nowrap shadow-pop transition-[left,top] duration-150 ease-[var(--ease-out-soft)]',
        side
          ? side === 'left' && '-translate-x-full'
          : [
              '-translate-y-full',
              align === 'center' && '-translate-x-1/2',
              align === 'right' && '-translate-x-full',
            ],
      )}
      style={{
        left: side ? x : align === 'left' ? Math.max(0, x - 16) : align === 'right' ? x + 16 : x,
        top: y,
      }}
    >
      {children}
    </div>
  );
}

export function TooltipTitle({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-caption font-semibold text-ink">{children}</p>;
}

export function TooltipRow({
  swatch,
  label,
  value,
  emphasis,
}: {
  swatch?: string;
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-5 text-[12px] leading-5">
      <span className="flex items-center gap-1.5 text-muted">
        {swatch && <span className={cn('size-2 rounded-full', swatch)} />}
        {label}
      </span>
      <span
        className={cn('tabular text-[12px]', emphasis ? 'font-semibold text-ink' : 'text-ink-2')}
      >
        {value}
      </span>
    </div>
  );
}

export function Legend({
  items,
}: {
  items: { label: string; swatch: string; dashed?: boolean }[];
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2 text-[12px] text-muted">
          {item.dashed ? (
            <span className={cn('h-0 w-3.5 border-t-2 border-dashed', item.swatch)} />
          ) : (
            <span className={cn('size-2.5 rounded-full', item.swatch)} />
          )}
          {item.label}
        </li>
      ))}
    </ul>
  );
}
