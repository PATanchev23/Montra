import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * The one resting surface in Montra: white on the canvas, held by a hairline
 * alone (no shadow). Panels never nest, and a screen's hero sits on the
 * canvas without one. Inside a panel, group content with space and rules.
 */
export function Panel({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn('min-w-0 rounded-panel border border-panel-line bg-surface', className)}
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
      <div className="min-w-0 flex-1 basis-56">
        <h2 id={id} className="text-title text-ink">
          {title}
        </h2>
        {description && <p className="mt-0.5 text-body-sm text-muted">{description}</p>}
      </div>
      {actions && (
        <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
