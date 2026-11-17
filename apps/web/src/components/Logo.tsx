import { cn } from '../lib/cn';

/**
 * The faceted gem mark with the wordmark. Same four facets as always, cut in
 * four tones of ink (grey upper facets, ink below), so the mark follows the
 * active theme.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-7 shrink-0', className)} aria-hidden>
      <g strokeLinejoin="round" strokeWidth="1.2">
        <path d="M16 2.5 4.5 14 16 17Z" className="fill-muted stroke-muted" />
        <path d="M16 2.5 27.5 14 16 17Z" className="fill-ink-2 stroke-ink-2" />
        <path d="M4.5 14 16 17v12.5Z" className="fill-accent stroke-accent" />
        <path
          d="M27.5 14 16 17v12.5Z"
          className="fill-accent stroke-accent"
          fillOpacity={0.55}
          strokeOpacity={0.55}
        />
      </g>
    </svg>
  );
}

export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      {!collapsed && (
        <span className="text-[18px] leading-6 font-semibold tracking-[-0.02em] text-ink">
          Montra
        </span>
      )}
    </span>
  );
}
