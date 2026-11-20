import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { useMessages } from '../../i18n';
import { common } from '../../i18n/common';

/** A panel that slides in from the edge — used for details and the mobile navigation. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  side = 'right',
  children,
  footer,
  className,
  hideTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  side?: 'left' | 'right';
  children: ReactNode;
  /** Pinned below the scrolling body, so its actions stay in reach and the body ends on a clean edge. */
  footer?: ReactNode;
  className?: string;
  hideTitle?: boolean;
}) {
  const m = useMessages(common);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay data-[state=open]:animate-[fade-in_160ms_ease-out]" />
        <Dialog.Content
          className={cn(
            'fixed top-0 bottom-0 z-50 flex w-full flex-col border-line bg-surface shadow-pop outline-none',
            // From 640px it floats inset from the edge with panel corners; on phones it fills the screen.
            side === 'right'
              ? 'right-0 max-w-md border-l sm:top-3 sm:right-3 sm:bottom-3 sm:overflow-hidden sm:rounded-panel sm:border data-[state=open]:animate-[slide-in-right_220ms_var(--ease-out-soft)]'
              : 'left-0 max-w-[288px] border-r data-[state=open]:animate-[slide-in-left_220ms_var(--ease-out-soft)]',
            className,
          )}
        >
          <div
            className={cn(
              'flex items-start justify-between gap-4 px-6 pt-5',
              hideTitle && 'sr-only',
            )}
          >
            <div>
              <Dialog.Title className="text-[16px] font-semibold text-ink">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="mt-0.5 text-[13px] text-muted">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label={m.close}
              className="-mr-2 flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-hover hover:text-ink"
            >
              <X className="size-4" strokeWidth={2} />
            </Dialog.Close>
          </div>
          {!description && <Dialog.Description className="sr-only">{title}</Dialog.Description>}
          {/* Inset on the floating right sheet so the scrollbar stops short of the rounded corners. */}
          <div
            className={cn(
              'min-h-0 flex-1 overflow-y-auto',
              side === 'right' && 'sm:mr-1.5',
              side === 'right' && !footer && 'sm:mb-2',
            )}
          >
            {children}
          </div>
          {footer && (
            <div className="flex shrink-0 justify-end gap-2 border-t border-line px-6 py-4">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
