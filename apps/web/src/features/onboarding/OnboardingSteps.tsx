import {
  DEFAULT_CURRENCY,
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
  timeZoneLabel,
  timeZoneOptions,
} from './options';

import { useMessages } from '../../i18n';
import { money } from '../../lib/format';
import { onboardingMessages } from './messages';
/** Three capsules, filled up to the current step, with the step names beneath. */
export function SetupProgress({ step }: { step: OnboardingStep }) {
  const currentIndex = onboardingStepSchema.options.indexOf(step);
  const m = useMessages(onboardingMessages);
  return (
    <ol aria-label={m.progress} className="grid grid-cols-3 gap-2">
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
              {m.steps[option].label}
              {done && <span className="sr-only">{m.done}</span>}
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
  const m = useMessages(onboardingMessages).fields;

  return (
    <>
      <TextField
        label={m.businessName}
        autoComplete="organization"
        placeholder={m.businessNamePlaceholder}
        hint={m.businessNameHint}
        error={form.errors.name}
        {...form.register('name')}
      />
      <TextField
        label={m.industryOptional}
        placeholder={m.industryPlaceholder}
        hint={m.industryHint}
        error={form.errors.industry}
        {...form.register('industry')}
      />
      <Field
        label={m.currency}
        htmlFor={currencyId}
        hint={m.currencyHint}
        error={form.errors.currency}
      >
        <Select
          id={currencyId}
          label={m.currency}
          value={form.values.currency as Currency}
          onChange={(value) => form.setValue('currency', value)}
          options={currencyOptions()}
          className={selectClass}
        />
      </Field>
      <Field
        label={m.timeZone}
        htmlFor={timeZoneId}
        hint={m.timeZoneHint}
        error={form.errors.timezone}
      >
        <Select
          id={timeZoneId}
          label={m.timeZone}
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
  const m = useMessages(onboardingMessages).fields;
  return (
    <>
      <Field
        label={m.fiscalYear}
        htmlFor={monthId}
        hint={m.fiscalYearHint}
        error={form.errors.fiscalYearStartMonth}
      >
        <Select
          id={monthId}
          label={m.fiscalYear}
          value={form.values.fiscalYearStartMonth}
          onChange={(value) => form.setValue('fiscalYearStartMonth', value)}
          options={monthOptions()}
          className={selectClass}
        />
      </Field>
      <TextField
        label={m.threshold(currency)}
        inputMode="decimal"
        autoComplete="off"
        placeholder={m.thresholdPlaceholder}
        hint={m.thresholdHint}
        error={form.errors.lowBalanceThreshold}
        {...form.register('lowBalanceThreshold')}
      />
    </>
  );
}

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
  const t = useMessages(onboardingMessages);
  const f = t.fields;
  const m = t.review;
  const missing = <span className="text-negative">{m.missing}</span>;

  const sections: { step: OnboardingStep; title: string; rows: [string, ReactNode][] }[] = [
    {
      step: 'BUSINESS_DETAILS',
      title: m.businessDetails,
      rows: [
        [f.businessName, details.name || missing],
        [m.industry, details.industry || <span className="text-muted">{m.notProvided}</span>],
        [f.currency, details.currency ? currencyLabel(details.currency) : missing],
        [f.timeZone, details.timezone ? timeZoneLabel(details.timezone) : missing],
      ],
    },
    {
      step: 'FINANCIAL_PREFERENCES',
      title: m.financialPreferences,
      rows: [
        [
          f.fiscalYear,
          monthName(preferences.fiscalYearStartMonth ?? DEFAULT_FISCAL_YEAR_START_MONTH),
        ],
        [
          m.threshold,
          threshold == null
            ? m.noWarning
            : money(threshold, { currency: details.currency ?? DEFAULT_CURRENCY }),
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
              aria-label={m.editSection(section.title)}
              onClick={() => onEdit(section.step)}
            >
              <Pencil />
              {m.edit}
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
