import { motion } from 'motion/react';
import { cn } from '../../lib/cn';

export type Status = 'up' | 'down' | 'degraded' | 'unknown';

const colors: Record<Status, string> = {
  up: 'bg-positive',
  degraded: 'bg-warning',
  down: 'bg-negative',
  unknown: 'bg-faint',
};

export function StatusDot({ status, className }: { status: Status; className?: string }) {
  return (
    <span className={cn('relative inline-flex size-2', className)} aria-hidden>
      {status === 'up' && (
        <motion.span
          className={cn('absolute inset-0 rounded-full', colors[status])}
          initial={{ opacity: 0.5, scale: 1 }}
          animate={{ opacity: 0, scale: 2.6 }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      <span className={cn('relative size-2 rounded-full transition-colors', colors[status])} />
    </span>
  );
}
