import { ChevronRight, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useMessages } from '../../i18n';
import { plansMessages } from './messages';
import { PlanCards, PlansFinePrint, PlanStatus } from './PlanCards';

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
        {/* A sheet: centred title over the plans, a round close button, the fine print beneath. */}
        <Dialog.Content className="fixed top-1/2 left-1/2 z-[60] flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[62rem] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[1.25rem] border border-line bg-canvas shadow-pop outline-none data-[state=closed]:animate-[pop-out_120ms_ease-in_forwards] data-[state=open]:animate-[pop-in_160ms_var(--ease-out-soft)]">
          {/*
            No tooltip here: the dialog focuses this button first, and a focus
            tooltip would swallow the first Escape meant for the dialog.
          */}
          <Dialog.Close
            aria-label={m.dialog.close}
            className="absolute top-4 right-4 z-10 inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-hover text-ink-2 transition-colors duration-150 hover:bg-line hover:text-ink"
          >
            <X aria-hidden className="size-4" strokeWidth={2.25} />
          </Dialog.Close>
          <div className="overflow-y-auto px-5 pt-10 pb-7 sm:px-8 sm:pt-12 sm:pb-8">
            <div className="mx-auto flex max-w-xl flex-col items-center text-center">
              <Dialog.Title className="text-[1.75rem] leading-tight font-semibold tracking-[-0.03em] text-balance text-ink sm:text-[2rem]">
                {m.dialog.title}
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-body text-balance text-ink-2">
                {m.description}
              </Dialog.Description>
              <PlanStatus className="mt-5" />
            </div>
            <PlanCards headingLevel="h3" className="mt-8" />
            <PlansFinePrint className="mt-6" />
            <div className="mt-4 flex justify-center">
              <Link
                to="/plans"
                onClick={() => {
                  onOpenChange(false);
                  onNavigate?.();
                }}
                className="group inline-flex items-center gap-1 rounded-sm text-body-sm font-medium text-ink hover:underline"
              >
                {m.dialog.seeAll}
                <ChevronRight
                  aria-hidden
                  className="size-4 transition-transform duration-150 group-hover:translate-x-0.5"
                  strokeWidth={2}
                />
              </Link>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
