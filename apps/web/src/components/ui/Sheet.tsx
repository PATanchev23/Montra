import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

/** A panel that slides in from the edge — used for details and the mobile navigation. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  side = 'right',
  children,
  className,
  hideTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  side?: 'left' | 'right';
  children: ReactNode;
  className?: string;
  hideTitle?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay data-[state=open]:animate-[fade-in_160ms_ease-out]" />
        <Dialog.Content
          className={cn(
            'fixed top-0 bottom-0 z-50 flex w-full flex-col border-line bg-surface shadow-pop outline-none',
            side === 'right'
              ? 'right-0 max-w-md border-l data-[state=open]:animate-[slide-in-right_220ms_var(--ease-out-soft)]'
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
              aria-label="Close"
              className="-mr-2 flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-hover hover:text-ink"
            >
              <X className="size-4" strokeWidth={2} />
            </Dialog.Close>
          </div>
          {!description && <Dialog.Description className="sr-only">{title}</Dialog.Description>}
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
