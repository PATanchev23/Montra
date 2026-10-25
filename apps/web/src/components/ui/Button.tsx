import { Slot } from 'radix-ui';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'analytic';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover',
  secondary:
    'border border-line bg-raised text-ink hover:border-line-strong hover:bg-hover data-[state=open]:bg-hover',
  ghost:
    'text-muted hover:bg-hover hover:text-ink data-[state=open]:bg-hover data-[state=open]:text-ink',
  /** Lavender — reserved for analytical actions (simulations, insights). */
  analytic: 'bg-chart-1 text-white hover:brightness-110',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-2.5 text-[13px] [&_svg]:size-3.5',
  md: 'h-9 gap-2 px-3.5 text-[13px] [&_svg]:size-4',
  lg: 'h-11 gap-2.5 px-5 text-sm [&_svg]:size-4',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Render the child element (e.g. a router Link) with button styling. */
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', asChild, className, type = 'button', ...props },
  ref,
) {
  const Component = asChild ? Slot.Root : 'button';
  return (
    <Component
      ref={ref}
      type={asChild ? undefined : type}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-control font-medium whitespace-nowrap transition-[background-color,border-color,color,filter] duration-150 select-none disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:shrink-0',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
