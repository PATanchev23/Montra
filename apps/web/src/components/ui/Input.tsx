import { Search, X } from 'lucide-react';
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { useMessages } from '../../i18n';
import { common } from '../../i18n/common';
import { cn } from '../../lib/cn';
import { fieldErrorId, fieldHintId } from './fieldIds';

/*
 * The `control` border holds 3:1 against every plane, so a field is findable
 * without its label. Focus uses the full-strength accent ring like every
 * other control; invalid fields switch both to the negative tone.
 */
const fieldClass =
  'h-9 w-full min-w-0 rounded-control border border-control bg-raised px-3 text-body-sm text-ink transition-colors duration-150 placeholder:text-muted hover:border-ink-2 focus:outline-none focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent focus-visible:outline-solid disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:border-negative aria-invalid:focus-visible:outline-negative';

/*
 * The top-bar search is a filled capsule with no outline: its glyph, its
 * placeholder and its place in the bar identify it, so it can stay quiet.
 * Focus raises it to the surface with the usual accent ring.
 */
const quietFieldClass =
  'border-transparent bg-hover hover:border-transparent hover:bg-pressed focus-visible:border-transparent focus-visible:bg-raised';

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
    /** `lg` is the 40px filled capsule in the top bar. */
    fieldSize?: 'md' | 'lg';
  }
>(function SearchField(
  { value, onValueChange, className, trailing, fieldSize = 'md', ...props },
  ref,
) {
  const large = fieldSize === 'lg';
  const m = useMessages(common);
  return (
    <div className={cn('relative min-w-0', className)}>
      <Search
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted',
          large ? 'left-4 size-4' : 'left-3 size-4',
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
          large ? cn(quietFieldClass, 'h-10 rounded-full pr-11 pl-10 text-body') : 'pr-9 pl-9',
        )}
        {...props}
      />
      {value ? (
        <button
          type="button"
          aria-label={m.clearSearch}
          onClick={() => onValueChange('')}
          className={cn(
            'absolute top-1/2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-pressed hover:text-ink',
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
      <label htmlFor={htmlFor} className="text-body-sm font-medium text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <p id={fieldErrorId(htmlFor)} className="text-caption text-negative">
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
