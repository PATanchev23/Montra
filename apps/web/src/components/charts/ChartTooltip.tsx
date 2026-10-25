import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * Floating readout shared by every chart. The chart supplies the anchor
 * point; the tooltip sits above it and flips its alignment near the edges.
 */
export function ChartTooltip({
  x,
  y,
  containerWidth,
  children,
}: {
  x: number;
  y: number;
  containerWidth: number;
  children: ReactNode;
}) {
  const align = x < 110 ? 'left' : x > containerWidth - 110 ? 'right' : 'center';
  return (
    <div
      role="presentation"
      className={cn(
        'pointer-events-none absolute z-10 min-w-40 -translate-y-full rounded-xl border border-line-strong bg-raised px-3 py-2.5 whitespace-nowrap shadow-pop transition-[left,top] duration-100 ease-out',
        align === 'center' && '-translate-x-1/2',
        align === 'right' && '-translate-x-full',
      )}
      style={{
        left: align === 'left' ? Math.max(0, x - 16) : align === 'right' ? x + 16 : x,
        top: y,
      }}
    >
      {children}
    </div>
  );
}

export function TooltipTitle({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-[12px] font-medium text-ink">{children}</p>;
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
