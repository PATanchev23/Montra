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
      className={cn('inline-flex shrink-0 items-center rounded-full bg-hover p-1', className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <ToggleGroup.Item
            key={option.value}
            value={option.value}
            className={cn(
              'relative flex-1 cursor-pointer rounded-full font-medium whitespace-nowrap transition-colors duration-150',
              size === 'sm' ? 'h-7 px-3 text-caption' : 'h-8 px-4 text-body-sm',
              active ? 'text-accent-ink' : 'text-ink-2 hover:text-ink',
            )}
          >
            {/* The ink pill glides between segments; the same capsule the charts are drawn with. */}
            {active && (
              <motion.span
                layoutId={indicatorId}
                className="absolute inset-0 rounded-full bg-accent"
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
