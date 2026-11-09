import { AlertDialog } from 'radix-ui';
import type { ReactNode } from 'react';
import { Button } from './Button';

/**
 * Asks before an action that cannot be undone. Stays open while the action
 * runs, so a failure can be read and retried; the caller closes it on success.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  busyLabel = 'Working…',
  busy = false,
  error,
  onConfirm,
  cancelLabel = 'Cancel',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  busyLabel?: string;
  busy?: boolean;
  /** Why the last attempt failed. */
  error?: string | null;
  onConfirm: () => void;
  cancelLabel?: string;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-overlay data-[state=open]:animate-[fade-in_160ms_ease-out]" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-[60] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-panel border border-line bg-raised p-6 shadow-pop outline-none data-[state=open]:animate-[pop-in_160ms_var(--ease-out-soft)]">
          <AlertDialog.Title className="text-[16px] font-semibold text-ink">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-[13px] leading-relaxed text-muted">
            {description}
          </AlertDialog.Description>
          {error && (
            <p role="alert" className="mt-3 text-[13px] text-negative">
              {error}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button disabled={busy}>{cancelLabel}</Button>
            </AlertDialog.Cancel>
            <Button
              className="bg-negative text-surface hover:bg-negative hover:brightness-110"
              variant="primary"
              disabled={busy}
              onClick={onConfirm}
            >
              {busy ? busyLabel : confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
