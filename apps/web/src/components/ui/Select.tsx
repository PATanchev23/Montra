import { Check, ChevronDown } from 'lucide-react';
import { Select as RadixSelect } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { popoverSurface } from './Menu';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
  className,
  disabled,
  id,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  /** Accessible label; the visible text is the selected option. */
  label: string;
  size?: 'sm' | 'md';
  className?: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <RadixSelect.Root value={value} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
      <RadixSelect.Trigger
        id={id}
        aria-label={label}
        className={cn(
          'inline-flex cursor-pointer items-center justify-between gap-2 rounded-control border border-control bg-raised text-ink transition-colors hover:border-ink-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-ink-2 [&>span]:truncate',
          size === 'sm' ? 'h-8 px-2.5 text-caption' : 'h-9 px-3 text-body-sm',
          className,
        )}
      >
        <RadixSelect.Value />
        <RadixSelect.Icon>
          <ChevronDown className="size-4 text-muted" strokeWidth={1.75} />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={6}
          className={cn(
            popoverSurface,
            'max-h-[min(20rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)]',
          )}
        >
          <RadixSelect.Viewport>
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                className="relative flex h-9 cursor-pointer items-center gap-2.5 rounded-control pr-8 pl-2.5 text-body-sm text-ink-2 outline-none select-none data-[highlighted]:bg-hover data-[highlighted]:text-ink data-[state=checked]:text-ink"
              >
                {option.icon}
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="absolute right-2.5">
                  <Check className="size-4 text-accent" strokeWidth={2.25} />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
