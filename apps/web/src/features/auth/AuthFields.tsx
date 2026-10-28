import { AlertTriangle, Eye, EyeOff, Info } from 'lucide-react';
import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { fieldErrorId, fieldHintId } from '../../components/ui/fieldIds';
import { Field, Input } from '../../components/ui/Input';
import { cn } from '../../lib/cn';

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string;
  hint?: ReactNode;
  error?: string;
};

function describedBy(id: string, error?: string, hint?: ReactNode) {
  return error ? fieldErrorId(id) : hint ? fieldHintId(id) : undefined;
}

export function TextField({ label, hint, error, className, ...props }: TextFieldProps) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={cn('h-11 text-[14px]', className)}
        {...props}
      />
    </Field>
  );
}

/** A password input with a show/hide toggle, so long passwords can be checked before submitting. */
export function PasswordField({ label, hint, error, className, ...props }: TextFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={cn('h-11 pr-11 text-[14px]', className)}
          {...props}
        />
        <button
          type="button"
          aria-label="Show password"
          aria-pressed={visible}
          aria-controls={id}
          onClick={() => setVisible((v) => !v)}
          className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-hover hover:text-ink"
        >
          <Icon className="size-[18px]" strokeWidth={1.6} />
        </button>
      </div>
    </Field>
  );
}

const noticeTones = {
  negative: { icon: AlertTriangle, className: 'border-negative/30 bg-negative-soft text-negative' },
  warning: { icon: AlertTriangle, className: 'border-warning/30 bg-warning-soft text-warning' },
  neutral: { icon: Info, className: 'border-line bg-sunken text-ink-2' },
} as const;

/** A message about the whole form, such as wrong credentials or an ended session. */
export function FormNotice({
  tone,
  children,
}: {
  tone: keyof typeof noticeTones;
  children: ReactNode;
}) {
  const { icon: Icon, className } = noticeTones[tone];
  return (
    <div
      role={tone === 'negative' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-control border px-3 py-2.5 text-[13px] leading-5',
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" strokeWidth={1.9} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
