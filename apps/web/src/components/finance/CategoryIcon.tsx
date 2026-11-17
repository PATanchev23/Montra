import type { CategoryId } from '../../demo/types';
import { cn } from '../../lib/cn';
import { categoryVisuals, type CategoryTone } from './categoryVisuals';

/*
 * Every category sits on the same quiet tile. Colour is kept for the money
 * itself, so a row's amount is the only thing that reads green or red.
 */
const tile = 'bg-sunken text-ink-2';
const toneClasses: Record<CategoryTone, string> = {
  positive: tile,
  negative: tile,
  analytic: tile,
  warning: tile,
  neutral: tile,
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
