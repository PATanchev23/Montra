import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * The one section surface in Montra: white on the paper canvas, held by a
 * hairline and a whisper of shadow. Panels never nest: inside a panel, group
 * content with rules, spacing or a sunken band instead.
 */
export function Panel({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        'min-w-0 rounded-panel border border-panel-line bg-surface shadow-panel',
        className,
      )}
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
        <h2 id={id} className="text-title text-ink">
          {title}
        </h2>
        {description && <p className="text-body-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
