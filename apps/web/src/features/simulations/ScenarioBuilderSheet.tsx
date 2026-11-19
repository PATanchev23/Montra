import type { ScenarioRule, TransactionType } from '@montra/shared';
import { useState, type FormEvent } from 'react';
import { useTransactionCategories } from '../../api/transactions';
import { Button } from '../../components/ui/Button';
import { fieldErrorId } from '../../components/ui/fieldIds';
import { Field, Input } from '../../components/ui/Input';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Select } from '../../components/ui/Select';
import { Sheet } from '../../components/ui/Sheet';
import { useMessages } from '../../i18n';
import { amountInputText, parseAmount } from '../../lib/amountInput';
import { simulationMessages } from './messages';

const NONE = '__none__';

interface Values {
  income: string;
  expenses: string;
  category: string;
  categoryChange: string;
  monthly: string;
  oneOffType: TransactionType;
  oneOffAmount: string;
  oneOffDate: string;
}

const valuesFrom = (rule: ScenarioRule): Values => ({
  income: rule.incomeChangePct?.toString() ?? '',
  expenses: rule.expenseChangePct?.toString() ?? '',
  category: rule.category ?? NONE,
  categoryChange: rule.categoryChangePct?.toString() ?? '',
  monthly: amountInputText(rule.monthlyCostCents ?? null),
  oneOffType: rule.oneOffType ?? 'EXPENSE',
  oneOffAmount: amountInputText(rule.oneOffCents ?? null),
  oneOffDate: rule.oneOffDate ?? '',
});

/** A whole percentage from −100 to 500, typed with or without a sign; empty is no change. */
function parsePercent(text: string): number | undefined | null {
  const compact = text.replace(/\s|%/g, '').replace('−', '-');
  if (compact === '') return undefined;
  if (!/^[-+]?\d+$/.test(compact)) return null;
  const value = Number(compact);
  return value >= -100 && value <= 500 ? value : null;
}

/** The form behind "New scenario": every change is optional and they combine. */
export function ScenarioBuilderSheet({
  businessId,
  currency,
  initial,
  onRun,
  onOpenChange,
}: {
  businessId: string;
  currency: string;
  initial: ScenarioRule;
  onRun: (rule: ScenarioRule) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const m = useMessages(simulationMessages).builder;
  const categories = useTransactionCategories(businessId);
  const [values, setValues] = useState(() => valuesFrom(initial));
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    const rule: ScenarioRule = {};

    const income = parsePercent(values.income);
    if (income === null) next.income = m.wholePercent;
    else if (income) rule.incomeChangePct = income;

    const expenses = parsePercent(values.expenses);
    if (expenses === null) next.expenses = m.wholePercent;
    else if (expenses) rule.expenseChangePct = expenses;

    const categoryChange = parsePercent(values.categoryChange);
    if (categoryChange === null) next.categoryChange = m.wholePercent;
    else if (values.category !== NONE || categoryChange !== undefined) {
      if (values.category === NONE || categoryChange === undefined) {
        next.categoryChange = m.needCategory;
      } else {
        rule.category = values.category;
        rule.categoryChangePct = categoryChange;
      }
    }

    const monthly = parseAmount(values.monthly);
    if (!monthly.ok) next.monthly = monthly.message;
    else if (monthly.cents) rule.monthlyCostCents = monthly.cents;

    const oneOff = parseAmount(values.oneOffAmount);
    if (!oneOff.ok) next.oneOffAmount = oneOff.message;
    else if (oneOff.cents || values.oneOffDate) {
      if (!oneOff.cents || !values.oneOffDate) next.oneOffAmount = m.needOneOff;
      else {
        rule.oneOffType = values.oneOffType;
        rule.oneOffCents = oneOff.cents;
        rule.oneOffDate = values.oneOffDate;
      }
    }

    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    onRun(rule);
  }

  const percentField = (key: 'income' | 'expenses', label: string) => (
    <Field label={label} htmlFor={`scenario-${key}`} hint={m.percentHint} error={errors[key]}>
      <Input
        id={`scenario-${key}`}
        inputMode="numeric"
        autoComplete="off"
        value={values[key]}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? fieldErrorId(`scenario-${key}`) : undefined}
        onChange={(e) => set(key, e.target.value)}
      />
    </Field>
  );

  return (
    <Sheet open onOpenChange={onOpenChange} title={m.title} description={m.description}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-5 px-6 pt-5 pb-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {percentField('income', m.income)}
          {percentField('expenses', m.expenses)}
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
          <Field label={m.category} htmlFor="scenario-category">
            <Select
              id="scenario-category"
              label={m.category}
              value={values.category}
              onChange={(v) => set('category', v)}
              className="w-full"
              options={[
                { value: NONE, label: m.categoryPlaceholder },
                ...(categories.data?.items ?? []).map((c) => ({ value: c.name, label: c.name })),
              ]}
            />
          </Field>
          <Field
            label={m.categoryChange}
            htmlFor="scenario-category-change"
            error={errors.categoryChange}
          >
            <Input
              id="scenario-category-change"
              inputMode="numeric"
              autoComplete="off"
              value={values.categoryChange}
              aria-invalid={errors.categoryChange ? true : undefined}
              onChange={(e) => set('categoryChange', e.target.value)}
            />
          </Field>
        </div>

        <Field
          label={m.monthly(currency)}
          htmlFor="scenario-monthly"
          hint={m.monthlyHint}
          error={errors.monthly}
        >
          <Input
            id="scenario-monthly"
            inputMode="decimal"
            autoComplete="off"
            value={values.monthly}
            aria-invalid={errors.monthly ? true : undefined}
            onChange={(e) => set('monthly', e.target.value)}
          />
        </Field>

        <fieldset className="flex flex-col gap-3 rounded-control border border-line p-4">
          <legend className="px-1 text-[13px] font-medium text-ink-2">{m.oneOff}</legend>
          <SegmentedControl
            label={m.oneOffType}
            value={values.oneOffType}
            onChange={(v) => set('oneOffType', v)}
            options={[
              { value: 'EXPENSE', label: m.out },
              { value: 'INCOME', label: m.in },
            ]}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={m.oneOffAmount(currency)}
              htmlFor="scenario-one-off"
              error={errors.oneOffAmount}
            >
              <Input
                id="scenario-one-off"
                inputMode="decimal"
                autoComplete="off"
                value={values.oneOffAmount}
                aria-invalid={errors.oneOffAmount ? true : undefined}
                onChange={(e) => set('oneOffAmount', e.target.value)}
              />
            </Field>
            <Field label={m.oneOffDate} htmlFor="scenario-one-off-date">
              <Input
                id="scenario-one-off-date"
                type="date"
                value={values.oneOffDate}
                onChange={(e) => set('oneOffDate', e.target.value)}
              />
            </Field>
          </div>
        </fieldset>

        <div className="flex justify-end gap-2 pt-1">
          <Button onClick={() => onOpenChange(false)}>{m.cancel}</Button>
          <Button type="submit" variant="primary">
            {m.run}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
