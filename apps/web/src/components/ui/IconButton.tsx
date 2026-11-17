import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { Tooltip } from './Tooltip';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name, also shown as a tooltip. */
  label: string;
  /** `lg` is the 44px square that sits beside the top-bar fields. */
  size?: 'sm' | 'md' | 'lg';
  bordered?: boolean;
}

const sizes = {
  sm: 'size-8 rounded-control',
  md: 'size-10 rounded-control',
  lg: 'size-11 rounded-field',
} as const;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = 'md', bordered = false, className, children, ...props },
  ref,
) {
  return (
    <Tooltip content={label}>
      <button
        ref={ref}
        type="button"
        aria-label={label}
        className={cn(
          'relative inline-flex shrink-0 cursor-pointer items-center justify-center text-ink-2 transition-colors duration-150 hover:bg-hover hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 data-[state=open]:bg-hover data-[state=open]:text-ink [&_svg]:size-[18px]',
          sizes[size],
          bordered && 'border border-line-strong bg-raised hover:border-control',
          className,
        )}
        {...props}
      >
        {children}
      </button>
    </Tooltip>
  );
});
