import { AlertTriangle, RotateCw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Button } from './Button';

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div aria-hidden style={style} className={cn('animate-pulse rounded-md bg-hover', className)} />
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      <span className="flex size-11 items-center justify-center rounded-full border border-line bg-sunken text-faint">
        <Icon className="size-5" strokeWidth={1.5} />
      </span>
      <p className="mt-4 font-medium text-ink">{title}</p>
      {body && <p className="mt-1 max-w-sm text-[13px] text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'Could not load this section',
  onRetry,
  className,
}: {
  title?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center px-6 py-12 text-center', className)}
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-negative-soft text-negative">
        <AlertTriangle className="size-5" strokeWidth={1.75} />
      </span>
      <p className="mt-4 font-medium text-ink">{title}</p>
      <p className="mt-1 text-[13px] text-muted">Check your connection and try again.</p>
      {onRetry && (
        <Button size="sm" className="mt-5" onClick={onRetry}>
          <RotateCw />
          Try again
        </Button>
      )}
    </div>
  );
}
