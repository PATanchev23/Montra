import { Tooltip as RadixTooltip } from 'radix-ui';
import type { ReactNode } from 'react';

export const TooltipProvider = RadixTooltip.Provider;

export function Tooltip({
  content,
  children,
  side = 'top',
}: {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-64 rounded-lg border border-line bg-raised px-2.5 py-1.5 text-[12px] leading-snug text-ink-2 shadow-pop"
        >
          {content}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
