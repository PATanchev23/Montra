import { Slot } from 'radix-ui';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'analytic';
type Size = 'sm' | 'md' | 'lg';

const primary = 'bg-accent text-accent-ink hover:bg-accent-hover';

const variants: Record<Variant, string> = {
  primary,
  /* A quiet fill rather than an outline: fewer lines on the page. */
  secondary: 'bg-hover text-ink hover:bg-pressed data-[state=open]:bg-pressed',
  ghost:
    'text-ink-2 hover:bg-hover hover:text-ink data-[state=open]:bg-hover data-[state=open]:text-ink',
  /**
   * Kept for pages not yet recomposed. Analysis has no colour of its own in
   * the monochrome system, so it renders as the primary (ink) action.
   */
  analytic: primary,
};

const sizes: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-3 text-body-sm [&_svg]:size-3.5',
  md: 'h-9 gap-2 px-4 text-body-sm [&_svg]:size-4',
  lg: 'h-11 gap-2 px-6 text-body [&_svg]:size-4',
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
        // Capsules: the button takes the chart's shape.
        'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full font-medium whitespace-nowrap transition-[background-color,color,scale] duration-150 ease-[var(--ease-standard)] select-none active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 [&_svg]:shrink-0',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
