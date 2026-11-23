import { Switch as RadixSwitch } from 'radix-ui';

export function Switch({
  checked,
  onCheckedChange,
  id,
  label,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <RadixSwitch.Root
      id={id}
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
      className="relative inline-flex h-[22px] w-[38px] shrink-0 cursor-pointer items-center rounded-full border border-line-strong bg-sunken transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-45 data-[state=checked]:border-accent data-[state=checked]:bg-accent"
    >
      <RadixSwitch.Thumb className="block size-4 translate-x-[2px] rounded-full bg-muted shadow-sm transition-transform duration-200 ease-out data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-accent-ink" />
    </RadixSwitch.Root>
  );
}
