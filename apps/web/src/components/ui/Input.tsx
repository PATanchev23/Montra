import { Search, X } from 'lucide-react';
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { fieldErrorId, fieldHintId } from './fieldIds';

/*
 * The `control` border holds 3:1 against every plane, so a field is findable
 * without its label. Focus uses the full-strength accent ring like every
 * other control; invalid fields switch both to the negative tone.
 */
const fieldClass =
  'h-9 w-full min-w-0 rounded-control border border-control bg-raised px-3 text-body-sm text-ink transition-colors placeholder:text-muted hover:border-ink-2 focus:outline-none focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:border-negative aria-invalid:focus-visible:outline-negative';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(fieldClass, className)} {...props} />;
  },
);

export const SearchField = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
    value: string;
    onValueChange: (value: string) => void;
    trailing?: ReactNode;
    /** `lg` is the 44px field in the top bar. */
    fieldSize?: 'md' | 'lg';
  }
>(function SearchField(
  { value, onValueChange, className, trailing, fieldSize = 'md', ...props },
  ref,
) {
  const large = fieldSize === 'lg';
  return (
    <div className={cn('relative min-w-0', className)}>
      <Search
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted',
          large ? 'left-4 size-[18px]' : 'left-3 size-4',
        )}
        strokeWidth={1.75}
      />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className={cn(
          fieldClass,
          '[&::-webkit-search-cancel-button]:hidden',
          large ? 'h-11 rounded-field pr-11 pl-11 text-body' : 'pr-9 pl-9',
        )}
        {...props}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onValueChange('')}
          className={cn(
            'absolute top-1/2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-hover hover:text-ink',
            large ? 'right-3' : 'right-2',
          )}
        >
          <X className="size-3.5" strokeWidth={2} />
        </button>
      ) : (
        trailing && (
          <span
            className={cn('absolute top-1/2 -translate-y-1/2', large ? 'right-3.5' : 'right-2.5')}
          >
            {trailing}
          </span>
        )
      )}
    </div>
  );
});

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  /** Replaces the hint while set. */
  error?: string;
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <p id={fieldErrorId(htmlFor)} className="text-[12px] text-negative">
          {error}
        </p>
      ) : (
        hint && (
          <p id={fieldHintId(htmlFor)} className="text-caption text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
