import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router';
import { LanguageSwitch } from '../../components/LanguageSwitch';
import { Logo } from '../../components/Logo';
import { useMessages } from '../../i18n';
import { authMessages } from './messages';

/* Twelve months of inflow: nine actual, three projected (hatched), as on the dashboard. */
const months = [46, 58, 52, 64, 61, 72, 68, 79, 74, 82, 88, 85];
const PROJECTED_FROM = 9;

/** A static, decorative take on the capsule chart, the product's signature visual. */
function CapsulePreview() {
  return (
    <div aria-hidden className="flex h-44 items-end gap-2.5">
      {months.map((value, index) => (
        <div key={index} className="relative h-full flex-1 rounded-full bg-chart-track">
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${value}%` }}
            transition={{ duration: 0.7, delay: 0.15 + index * 0.04, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-x-0 bottom-0 rounded-full bg-chart-1"
            style={
              index >= PROJECTED_FROM
                ? {
                    background:
                      'repeating-linear-gradient(135deg, var(--chart-1) 0 3px, transparent 3px 7px)',
                  }
                : undefined
            }
          />
        </div>
      ))}
    </div>
  );
}

function BrandPanel() {
  const m = useMessages(authMessages).layout;
  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden border-l border-line bg-sidebar px-12 py-12 xl:px-16">
      <div>
        <p className="eyebrow">{m.eyebrow}</p>
        <h2 className="mt-3 max-w-md text-[30px] leading-[1.15] font-semibold tracking-[-0.025em] text-ink">
          {m.headline}
        </h2>
      </div>

      <div className="rounded-panel border border-line bg-surface p-6">
        <div className="mb-5 flex items-baseline justify-between">
          <span className="text-[13px] font-medium text-ink-2">{m.monthlyInflow}</span>
          <span className="flex items-center gap-3 text-[12px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-chart-1" /> {m.actual}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full border border-chart-1" /> {m.projected}
            </span>
          </span>
        </div>
        <CapsulePreview />
      </div>

      <ul className="flex flex-col gap-3">
        {m.highlights.map((text) => (
          <li key={text} className="flex items-center gap-3 text-[14px] text-ink-2">
            <span className="size-1.5 shrink-0 rounded-full bg-accent" />
            {text}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The frame for signed-out pages and the onboarding hold page: content on the
 * left, a brand panel on wide screens. Renders the matched route by default.
 */
export function AuthLayout({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const m = useMessages(authMessages).layout;
  return (
    <div className="grid min-h-dvh bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex min-h-dvh flex-col px-5 py-6 sm:px-10 lg:px-14 lg:py-10">
        <div className="flex items-center justify-between gap-4">
          <Logo />
          <LanguageSwitch />
        </div>
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10"
        >
          {children ?? <Outlet />}
        </motion.main>
        <p className="text-[12px] text-faint">{m.footer}</p>
      </div>
      <div className="hidden lg:block">
        <BrandPanel />
      </div>
    </div>
  );
}

/** Title block shared by the auth pages. */
export function AuthHeading({ title, description }: { title: string; description: ReactNode }) {
  return (
    <header className="mb-7">
      <h1 className="text-[26px] leading-[1.15] font-semibold tracking-[-0.025em] text-ink">
        {title}
      </h1>
      <p className="mt-2 text-[14px] text-muted">{description}</p>
    </header>
  );
}
