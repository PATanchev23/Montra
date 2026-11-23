import { ArrowRight, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/Button';
import { useMessages } from '../../i18n';
import { plansMessages } from './messages';
import { EarlyAccessNote, PlanCards } from './PlanCards';

/** Marks the control that opens the plans dialog (use with `asChild`). */
export const PlansDialogTrigger = Dialog.Trigger;

/**
 * The plans at a glance, opened from Upgrade in the sidebar, with a way on to
 * the full comparison on the Plans page.
 */
export function PlansDialog({
  open,
  onOpenChange,
  onNavigate,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the dialog leads to the Plans page (the phone sheet closes too). */
  onNavigate?: () => void;
  /** What opens it, wrapped in `PlansDialogTrigger` so focus returns there on close. */
  children?: ReactNode;
}) {
  const m = useMessages(plansMessages);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {children}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-overlay data-[state=closed]:animate-[fade-out_120ms_ease-in_forwards] data-[state=open]:animate-[fade-in_160ms_ease-out]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-[60] flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[64rem] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-panel border border-line bg-canvas shadow-pop outline-none data-[state=closed]:animate-[pop-out_120ms_ease-in_forwards] data-[state=open]:animate-[pop-in_160ms_var(--ease-out-soft)]">
          <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
            <div className="min-w-0">
              <Dialog.Title className="text-title text-ink">{m.dialog.title}</Dialog.Title>
              <Dialog.Description className="mt-1 text-body-sm text-muted">
                {m.description}
              </Dialog.Description>
            </div>
            {/*
              No tooltip here: the dialog focuses this button first, and a focus
              tooltip would swallow the first Escape meant for the dialog.
            */}
            <Dialog.Close
              aria-label={m.dialog.close}
              className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-control text-ink-2 transition-colors duration-150 hover:bg-hover hover:text-ink"
            >
              <X aria-hidden className="size-[18px]" />
            </Dialog.Close>
          </div>
          <div className="overflow-y-auto px-5 pb-5 sm:px-6 sm:pb-6">
            <EarlyAccessNote className="mt-4" />
            <PlanCards headingLevel="h3" className="mt-4" />
            <div className="mt-5 flex justify-center">
              <Button asChild variant="ghost">
                <Link
                  to="/plans"
                  onClick={() => {
                    onOpenChange(false);
                    onNavigate?.();
                  }}
                >
                  {m.dialog.seeAll}
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
