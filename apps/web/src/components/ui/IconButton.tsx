import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { Tooltip } from './Tooltip';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name, also shown as a tooltip. */
  label: string;
  /** `lg` is the 44px circle that sits beside the top-bar fields. */
  size?: 'sm' | 'md' | 'lg';
  bordered?: boolean;
}

const sizes = {
  sm: 'size-8',
  md: 'size-10',
  lg: 'size-11',
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
          'relative inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-2 transition-colors duration-150 hover:bg-hover hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 data-[state=open]:bg-hover data-[state=open]:text-ink [&_svg]:size-[18px]',
          sizes[size],
          // A resting fill instead of an outline, for buttons that sit beside fields.
          bordered && 'bg-hover hover:bg-pressed data-[state=open]:bg-pressed',
          className,
        )}
        {...props}
      >
        {children}
      </button>
    </Tooltip>
  );
});
