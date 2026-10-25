import { Check } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;
export const MenuRadioGroup = DropdownMenu.RadioGroup;

export const popoverSurface =
  'z-50 rounded-xl border border-line bg-raised p-1 shadow-pop outline-none data-[state=open]:animate-[pop-in_140ms_var(--ease-out-soft)]';

export function MenuContent({
  className,
  align = 'end',
  sideOffset = 6,
  ...props
}: ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(popoverSurface, 'min-w-48', className)}
        {...props}
      />
    </DropdownMenu.Portal>
  );
}

const itemClass =
  'relative flex h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-ink-2 outline-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45 data-[highlighted]:bg-hover data-[highlighted]:text-ink [&_svg]:size-4 [&_svg]:text-muted';

export function MenuItem({ className, ...props }: ComponentProps<typeof DropdownMenu.Item>) {
  return <DropdownMenu.Item className={cn(itemClass, className)} {...props} />;
}

export function MenuRadioItem({
  className,
  children,
  hint,
  ...props
}: ComponentProps<typeof DropdownMenu.RadioItem> & { hint?: ReactNode }) {
  return (
    <DropdownMenu.RadioItem className={cn(itemClass, 'pr-8', className)} {...props}>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate">{children}</span>
        {hint && <span className="truncate text-[11px] text-faint">{hint}</span>}
      </span>
      <DropdownMenu.ItemIndicator className="absolute right-2.5">
        <Check className="!text-accent" strokeWidth={2.25} />
      </DropdownMenu.ItemIndicator>
    </DropdownMenu.RadioItem>
  );
}

export function MenuCheckboxItem({
  className,
  children,
  ...props
}: ComponentProps<typeof DropdownMenu.CheckboxItem>) {
  return (
    <DropdownMenu.CheckboxItem
      className={cn(itemClass, className)}
      onSelect={(e) => e.preventDefault()}
      {...props}
    >
      <span className="flex size-4 items-center justify-center rounded-[5px] border border-line-strong data-[state=checked]:border-accent data-[state=checked]:bg-accent">
        <DropdownMenu.ItemIndicator>
          <Check className="!size-3 !text-accent-ink" strokeWidth={3} />
        </DropdownMenu.ItemIndicator>
      </span>
      {children}
    </DropdownMenu.CheckboxItem>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu.Label className="px-2.5 pt-2 pb-1 text-[11px] font-medium text-faint">
      {children}
    </DropdownMenu.Label>
  );
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-line" />;
}
