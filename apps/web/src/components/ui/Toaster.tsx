import { CheckCircle2, Info, X } from 'lucide-react';
import { Toast } from 'radix-ui';
import { cn } from '../../lib/cn';
import { useToastStore, type ToastTone } from '../../stores/toasts';

const toneIcon: Record<ToastTone, { icon: typeof Info; className: string }> = {
  positive: { icon: CheckCircle2, className: 'bg-positive-soft text-positive' },
  neutral: { icon: Info, className: 'bg-hover text-ink-2' },
};

/** Renders toasts raised with `showToast`. Mounted once, outside the router. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <Toast.Provider swipeDirection="right" duration={4500}>
      {toasts.map(({ id, title, body, tone }) => {
        const { icon: Icon, className } = toneIcon[tone];
        return (
          <Toast.Root
            key={id}
            onOpenChange={(open) => !open && dismiss(id)}
            className="flex items-start gap-3 rounded-xl border border-line bg-raised p-3.5 shadow-pop data-[state=open]:animate-[pop-in_180ms_var(--ease-out-soft)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]"
          >
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full',
                className,
              )}
            >
              <Icon className="size-4" strokeWidth={1.9} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <Toast.Title className="text-[13px] leading-snug font-medium text-ink">
                {title}
              </Toast.Title>
              {body && (
                <Toast.Description className="mt-0.5 text-[12px] leading-snug text-muted">
                  {body}
                </Toast.Description>
              )}
            </div>
            <Toast.Close
              aria-label="Dismiss"
              className="flex size-6 cursor-pointer items-center justify-center rounded-md text-faint hover:bg-hover hover:text-ink"
            >
              <X className="size-3.5" strokeWidth={2} />
            </Toast.Close>
          </Toast.Root>
        );
      })}
      <Toast.Viewport className="fixed right-4 bottom-4 z-[100] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2 outline-none" />
    </Toast.Provider>
  );
}
