import { cn } from '../lib/cn';

/** Faceted gem mark — teal into ocean blue — with the wordmark. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8 shrink-0', className)} aria-hidden>
      <g strokeLinejoin="round" strokeWidth="1.2">
        <path d="M16 2.5 4.5 14 16 17Z" fill="#62dcc8" stroke="#62dcc8" />
        <path d="M16 2.5 27.5 14 16 17Z" fill="#2fa9c8" stroke="#2fa9c8" />
        <path d="M4.5 14 16 17v12.5Z" fill="#1e9d8e" stroke="#1e9d8e" />
        <path d="M27.5 14 16 17v12.5Z" fill="#1c6c93" stroke="#1c6c93" />
      </g>
    </svg>
  );
}

export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      {!collapsed && (
        <span className="text-[19px] font-semibold tracking-[-0.02em] text-ink">Montra</span>
      )}
    </span>
  );
}
