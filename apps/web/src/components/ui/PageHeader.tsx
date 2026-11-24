import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * A page's title, its one-line context and its actions. The title speaks for
 * itself: `eyebrow` is still accepted from pages not yet recomposed, but it is
 * no longer drawn (no kicker above a title, see DESIGN.md).
 */
export function PageHeader({
  title,
  description,
  actions,
  actionsClassName,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** For actions that span the width on phones: the wrapper must span it too. */
  actionsClassName?: string;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="min-w-0">
        <h1 className="text-figure text-balance text-ink sm:text-display">{title}</h1>
        {description && (
          <div className="mt-2 max-w-[68ch] text-body-lg text-muted">{description}</div>
        )}
      </div>
      {actions && (
        <div className={cn('flex flex-wrap items-center gap-2', actionsClassName)}>{actions}</div>
      )}
    </header>
  );
}
