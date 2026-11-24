import { AlertTriangle, RotateCw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { useMessages } from '../../i18n';
import { common } from '../../i18n/common';
import { cn } from '../../lib/cn';
import { Button } from './Button';

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      aria-hidden
      style={style}
      className={cn('animate-pulse rounded-control bg-hover motion-reduce:animate-none', className)}
    />
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
    <div className={cn('flex flex-col items-center px-6 py-16 text-center', className)}>
      <Icon aria-hidden className="size-6 text-muted" strokeWidth={1.5} />
      <p className="mt-4 text-title text-ink">{title}</p>
      {body && <div className="mt-1 max-w-sm text-body text-muted">{body}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title,
  onRetry,
  className,
}: {
  title?: string;
  onRetry?: () => void;
  className?: string;
}) {
  const m = useMessages(common);
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center px-6 py-16 text-center', className)}
    >
      <AlertTriangle aria-hidden className="size-6 text-negative" strokeWidth={1.5} />
      <p className="mt-4 text-title text-ink">{title ?? m.loadError}</p>
      <p className="mt-1 max-w-sm text-body text-muted">{m.loadErrorHint}</p>
      {onRetry && (
        <Button size="sm" className="mt-6" onClick={onRetry}>
          <RotateCw />
          {m.tryAgain}
        </Button>
      )}
    </div>
  );
}
