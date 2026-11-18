import { cn } from '../lib/cn';

/**
 * Two stacked diamonds whose overlap is cut out (even-odd fill), traced from
 * design/LogoLightTheme.png and design/LogoDarkTheme.png. It fills with the
 * ink token, so it is black on the light theme and white on the dark one.
 */
const MARK_PATH =
  'M19.58 0.25A0.7 0.7 0 0 1 20.42 0.25L36.24 11.94A0.7 0.7 0 0 1 36.24 13.06L20.42 24.75A0.7 0.7 0 0 1 19.58 24.75L3.76 13.06A0.7 0.7 0 0 1 3.76 11.94Z' +
  'M19.58 15.25A0.7 0.7 0 0 1 20.42 15.25L36.24 26.94A0.7 0.7 0 0 1 36.24 28.06L20.42 39.75A0.7 0.7 0 0 1 19.58 39.75L3.76 28.06A0.7 0.7 0 0 1 3.76 26.94Z';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn('size-7 shrink-0 fill-ink', className)} aria-hidden>
      <path fillRule="evenodd" d={MARK_PATH} />
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
