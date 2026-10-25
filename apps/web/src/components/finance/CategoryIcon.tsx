import type { CategoryId } from '../../demo/types';
import { cn } from '../../lib/cn';
import { categoryVisuals, type CategoryTone } from './categoryVisuals';

const toneClasses: Record<CategoryTone, string> = {
  positive: 'bg-positive-soft text-positive',
  negative: 'bg-negative-soft text-negative',
  analytic: 'bg-chart-1-soft text-chart-1',
  warning: 'bg-warning-soft text-warning',
  neutral: 'bg-hover text-ink-2',
};

export function CategoryIcon({
  categoryId,
  size = 'md',
  className,
}: {
  categoryId: CategoryId;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const { icon: Icon, tone } = categoryVisuals[categoryId];
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-[10px]',
        size === 'sm' ? 'size-8' : 'size-9',
        toneClasses[tone],
        className,
      )}
    >
      <Icon className={size === 'sm' ? 'size-4' : 'size-[18px]'} strokeWidth={1.75} />
    </span>
  );
}
