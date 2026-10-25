import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * The one container style in Montra: a quiet surface with a hairline border.
 * Panels never nest — inside a panel, group content with dividers or a
 * sunken background instead.
 */
export function Panel({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn('min-w-0 rounded-panel border border-line bg-surface', className)}
      {...props}
    />
  );
}

export function PanelHeader({
  title,
  description,
  actions,
  className,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <header
      className={cn(
        'flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-2',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 id={id} className="text-[16px] leading-6 font-semibold tracking-[-0.01em] text-ink">
          {title}
        </h2>
        {description && <p className="text-[13px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
