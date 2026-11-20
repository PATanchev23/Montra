import { AnimatePresence, motion, useIsPresent } from 'motion/react';
import { cn } from '../../lib/cn';

/** Exponential ease-out: the new value arrives quickly and settles. */
const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/**
 * Text that rolls to its new value: the old one lifts away as the new one
 * rises into place. Unchanged text stays put, so it only moves when it changes.
 *
 * Old and new share one grid cell, so the swap measures nothing, and only
 * opacity and transform move, which the compositor handles on its own.
 */
export function RollingText({ children, className }: { children: string; className?: string }) {
  return (
    <span className={cn('inline-grid', className)}>
      <AnimatePresence initial={false}>
        <Roll key={children}>{children}</Roll>
      </AnimatePresence>
    </span>
  );
}

function Roll({ children }: { children: string }) {
  // The value on its way out is only a picture of the old one.
  const present = useIsPresent();
  return (
    <motion.span
      aria-hidden={present ? undefined : true}
      className="[grid-area:1/1] whitespace-nowrap"
      initial={{ opacity: 0, y: '0.4em' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '-0.4em' }}
      transition={{ duration: 0.24, ease: EASE_OUT }}
    >
      {children}
    </motion.span>
  );
}
