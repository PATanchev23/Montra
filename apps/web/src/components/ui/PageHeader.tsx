import type { ReactNode } from 'react';

/**
 * A page's title, its one-line context and its actions. `eyebrow` is kept
 * only for pages that have not moved to the new system yet; new pages leave
 * it out and let the title speak.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-[1.625rem] leading-8 font-semibold tracking-[-0.025em] text-balance text-ink sm:text-display">
          {title}
        </h1>
        {description && <p className="mt-1.5 text-body-lg text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
