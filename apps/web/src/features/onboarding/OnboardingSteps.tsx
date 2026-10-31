import {
  DEFAULT_CURRENCY,
  formatMoney,
  onboardingStepSchema,
  type Currency,
  type OnboardingDraft,
  type OnboardingStep,
} from '@montra/shared';
import { Check, Pencil } from 'lucide-react';
import { Fragment, useId, useMemo, type ReactNode } from 'react';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { cn } from '../../lib/cn';
import { TextField } from '../auth/AuthFields';
import type { SchemaForm } from '../auth/useSchemaForm';
import {
  DEFAULT_FISCAL_YEAR_START_MONTH,
  type detailsFormSchema,
  type preferencesFormSchema,
} from './draft';
import {
  currencyLabel,
  currencyOptions,
  monthName,
  monthOptions,
  stepCopy,
  timeZoneLabel,
  timeZoneOptions,
} from './options';

/** Three capsules, filled up to the current step, with the step names beneath. */
export function SetupProgress({ step }: { step: OnboardingStep }) {
  const currentIndex = onboardingStepSchema.options.indexOf(step);
  return (
    <ol aria-label="Setup progress" className="grid grid-cols-3 gap-2">
      {onboardingStepSchema.options.map((option, index) => {
        const done = index < currentIndex;
        const current = index === currentIndex;
        return (
          <li key={option} aria-current={current ? 'step' : undefined}>
            <span
              aria-hidden
              className={cn(
                'block h-1.5 rounded-full transition-colors duration-300',
                done || current ? 'bg-accent' : 'bg-chart-track',
              )}
            />
            <span
              className={cn(
                'mt-2 flex items-center gap-1 text-[12px]',
                current ? 'font-medium text-ink' : done ? 'text-ink-2' : 'text-faint',
              )}
            >
              {done && <Check aria-hidden className="size-3 text-accent" strokeWidth={2.5} />}
              {stepCopy[option].label}
              {done && <span className="sr-only">(done)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const selectClass = 'h-11 w-full text-[14px]';

export function DetailsFields({ form }: { form: SchemaForm<typeof detailsFormSchema> }) {
  const currencyId = useId();
  const timeZoneId = useId();
  const zones = useMemo(() => timeZoneOptions(form.values.timezone), [form.values.timezone]);

  return (
    <>
      <TextField
        label="Business name"
        autoComplete="organization"
        placeholder="e.g. TechStore"
        hint="How your store appears across Montra."
        error={form.errors.name}
        {...form.register('name')}
      />
      <TextField
        label="Industry (optional)"
        placeholder="e.g. Consumer electronics"
        hint="What you sell. Leave blank if you’d rather not say."
        error={form.errors.industry}
        {...form.register('industry')}
      />
      <Field
        label="Currency"
        htmlFor={currencyId}
        hint="Montra records and reports your money in this currency."
        error={form.errors.currency}
      >
        <Select
          id={currencyId}
          label="Currency"
          value={form.values.currency as Currency}
          onChange={(value) => form.setValue('currency', value)}
          options={currencyOptions}
          className={selectClass}
        />
      </Field>
      <Field
        label="Time zone"
        htmlFor={timeZoneId}
        hint="Decides when each day starts in your reports."
        error={form.errors.timezone}
      >
        <Select
          id={timeZoneId}
          label="Time zone"
          value={form.values.timezone}
          onChange={(value) => form.setValue('timezone', value)}
          options={zones}
          className={selectClass}
        />
      </Field>
    </>
  );
}

export function PreferencesFields({
  form,
  currency,
}: {
  form: SchemaForm<typeof preferencesFormSchema>;
  currency: string;
}) {
  const monthId = useId();
  return (
    <>
      <Field
        label="Financial year starts in"
        htmlFor={monthId}
        hint="Yearly figures run from the first day of this month."
        error={form.errors.fiscalYearStartMonth}
      >
        <Select
          id={monthId}
          label="Financial year starts in"
          value={form.values.fiscalYearStartMonth}
          onChange={(value) => form.setValue('fiscalYearStartMonth', value)}
          options={monthOptions}
          className={selectClass}
        />
      </Field>
      <TextField
        label={`Low-balance threshold in ${currency} (optional)`}
        inputMode="decimal"
        autoComplete="off"
        placeholder="e.g. 2500"
        hint="Montra warns you when your projected balance drops below this. Leave blank for no warning."
        error={form.errors.lowBalanceThreshold}
        {...form.register('lowBalanceThreshold')}
      />
    </>
  );
}

const missing = <span className="text-negative">Missing</span>;

/** The saved answers, which are exactly what Montra will create the business from. */
export function ReviewSummary({
  draft,
  onEdit,
  disabled,
}: {
  draft: OnboardingDraft;
  onEdit: (step: OnboardingStep) => void;
  disabled?: boolean;
}) {
  const details = draft.businessDetails ?? {};
  const preferences = draft.financialPreferences ?? {};
  const threshold = preferences.lowBalanceThresholdCents;

  const sections: { step: OnboardingStep; title: string; rows: [string, ReactNode][] }[] = [
    {
      step: 'BUSINESS_DETAILS',
      title: 'Business details',
      rows: [
        ['Business name', details.name || missing],
        ['Industry', details.industry || <span className="text-muted">Not provided</span>],
        ['Currency', details.currency ? currencyLabel(details.currency) : missing],
        ['Time zone', details.timezone ? timeZoneLabel(details.timezone) : missing],
      ],
    },
    {
      step: 'FINANCIAL_PREFERENCES',
      title: 'Financial preferences',
      rows: [
        [
          'Financial year starts in',
          monthName(preferences.fiscalYearStartMonth ?? DEFAULT_FISCAL_YEAR_START_MONTH),
        ],
        [
          'Low-balance threshold',
          threshold == null
            ? 'No warning'
            : formatMoney(threshold, { currency: details.currency ?? DEFAULT_CURRENCY }),
        ],
      ],
    },
  ];

  return (
    <div className="flex flex-col divide-y divide-line rounded-panel border border-line bg-surface">
      {sections.map((section) => (
        <section key={section.step} aria-label={section.title} className="px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[14px] font-medium text-ink">{section.title}</h2>
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              aria-label={`Edit ${section.title.toLowerCase()}`}
              onClick={() => onEdit(section.step)}
            >
              <Pencil />
              Edit
            </Button>
          </div>
          <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13px]">
            {section.rows.map(([label, value]) => (
              <Fragment key={label}>
                <dt className="text-muted">{label}</dt>
                <dd className="text-right break-words text-ink">{value}</dd>
              </Fragment>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
