import { Search, X } from 'lucide-react';
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { fieldErrorId, fieldHintId } from './fieldIds';

const fieldClass =
  'h-9 w-full min-w-0 rounded-control border border-line bg-raised px-3 text-[13px] text-ink transition-colors placeholder:text-faint hover:border-line-strong focus:border-accent-line focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent/40 disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:border-negative aria-invalid:focus-visible:outline-negative/40';

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
  }
>(function SearchField({ value, onValueChange, className, trailing, ...props }, ref) {
  return (
    <div className={cn('relative min-w-0', className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint"
        strokeWidth={1.75}
      />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className={cn(fieldClass, 'pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden')}
        {...props}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onValueChange('')}
          className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-faint hover:bg-hover hover:text-ink"
        >
          <X className="size-3.5" strokeWidth={2} />
        </button>
      ) : (
        trailing && <span className="absolute top-1/2 right-2.5 -translate-y-1/2">{trailing}</span>
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
          <p id={fieldHintId(htmlFor)} className="text-[12px] text-faint">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
