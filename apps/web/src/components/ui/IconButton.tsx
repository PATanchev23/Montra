import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { Tooltip } from './Tooltip';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name, also shown as a tooltip. */
  label: string;
  size?: 'sm' | 'md';
  bordered?: boolean;
}

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
          'relative inline-flex shrink-0 cursor-pointer items-center justify-center rounded-control text-muted transition-colors duration-150 hover:bg-hover hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 data-[state=open]:bg-hover data-[state=open]:text-ink [&_svg]:size-[18px]',
          size === 'sm' ? 'size-8' : 'size-10',
          bordered && 'border border-line bg-raised hover:border-line-strong',
          className,
        )}
        {...props}
      >
        {children}
      </button>
    </Tooltip>
  );
});
