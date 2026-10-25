import { motion } from 'motion/react';
import { ToggleGroup } from 'radix-ui';
import { useId } from 'react';
import { cn } from '../../lib/cn';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const indicatorId = useId();
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(next) => next && onChange(next as T)}
      aria-label={label}
      className={cn(
        'inline-flex shrink-0 items-center rounded-control border border-line bg-sunken p-[3px]',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <ToggleGroup.Item
            key={option.value}
            value={option.value}
            className={cn(
              'relative cursor-pointer rounded-[7px] font-medium transition-colors duration-150',
              size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-[30px] px-3.5 text-[13px]',
              active ? 'text-ink' : 'text-muted hover:text-ink',
            )}
          >
            {active && (
              <motion.span
                layoutId={indicatorId}
                className="absolute inset-0 rounded-[7px] border border-selected-line bg-selected"
                transition={{ type: 'spring', stiffness: 520, damping: 42 }}
              />
            )}
            <span className="relative">{option.label}</span>
          </ToggleGroup.Item>
        );
      })}
    </ToggleGroup.Root>
  );
}
