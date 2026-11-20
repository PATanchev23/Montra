import type { ScenarioPresetId, ScenarioRule, TransactionType } from '@montra/shared';
import { ChevronDown, Sparkles } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { useSimulation } from '../../api/finance';
import { useTransactionCategories } from '../../api/transactions';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { DatePicker } from '../../components/ui/DatePicker';
import { fieldErrorId } from '../../components/ui/fieldIds';
import { Field, Input } from '../../components/ui/Input';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Select } from '../../components/ui/Select';
import { Sheet } from '../../components/ui/Sheet';
import { Skeleton } from '../../components/ui/States';
import { useMessages } from '../../i18n';
import { amountInputText, parseAmount } from '../../lib/amountInput';
import { cn } from '../../lib/cn';
import { formatDate, money } from '../../lib/format';
import type { ScenarioText } from './describe';
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

const sameValues = (a: Values, b: Values) =>
  (Object.keys(a) as (keyof Values)[]).every((key) => a[key] === b[key]);

/** A ready-made scenario offered in the form, already described. */
export interface ScenarioSuggestion {
  id: ScenarioPresetId;
  rule: ScenarioRule;
  text: ScenarioText;
}

/** A whole percentage from −100 to 500, typed with or without a sign; empty is no change. */
function parsePercent(text: string): number | undefined | null {
  const compact = text.replace(/\s|%/g, '').replace('−', '-');
  if (compact === '') return undefined;
  if (!/^[-+]?\d+$/.test(compact)) return null;
  const value = Number(compact);
  return value >= -100 && value <= 500 ? value : null;
}

/**
 * The form behind "New scenario": every change is optional and they combine.
 * Suggestions sized to the business fill the form in one click; run as they
 * are, they keep their own name, and once changed they become the user's own.
 */
export function ScenarioBuilderSheet({
  businessId,
  currency,
  initial,
  suggestions,
  onRun,
  onRunSuggestion,
  onOpenChange,
}: {
  businessId: string;
  currency: string;
  initial: ScenarioRule;
  suggestions: ScenarioSuggestion[];
  onRun: (rule: ScenarioRule) => void;
  onRunSuggestion: (id: ScenarioPresetId) => void;
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

  // The suggestion the form still holds unchanged, if any, and whether it is opened up.
  const chosen = suggestions.find((s) => sameValues(values, valuesFrom(s.rule)));
  const [openId, setOpenId] = useState<ScenarioPresetId | null>(null);
  const suggestionOpen = chosen !== undefined && openId === chosen.id;
  const reduceMotion = useReducedMotion();
  const toggle = (suggestion: ScenarioSuggestion) => {
    if (chosen?.id === suggestion.id && openId === suggestion.id) {
      setOpenId(null);
      return;
    }
    setValues(valuesFrom(suggestion.rule));
    setErrors({});
    setOpenId(suggestion.id);
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    if (chosen) {
      onRunSuggestion(chosen.id);
      return;
    }
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

  // A suggestion may name a category before the list has loaded.
  const names = (categories.data?.items ?? []).map((c) => c.name);
  if (values.category !== NONE && !names.includes(values.category)) names.push(values.category);
  const categoryOptions = [
    { value: NONE, label: m.categoryPlaceholder },
    ...names.map((name) => ({ value: name, label: name })),
  ];

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
    <Sheet
      open
      onOpenChange={onOpenChange}
      title={m.title}
      description={m.description}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{m.cancel}</Button>
          <Button type="submit" form="scenario-form" variant="primary">
            {m.run}
          </Button>
        </>
      }
    >
      <form
        id="scenario-form"
        noValidate
        onSubmit={submit}
        className="flex flex-col gap-5 px-6 pt-5 pb-6"
      >
        {suggestions.length > 0 && (
          <section aria-labelledby="scenario-suggested" className="flex flex-col gap-2 pb-5">
            <div>
              <h3 id="scenario-suggested" className="text-[13px] font-medium text-ink-2">
                {m.suggested}
              </h3>
              <p className="mt-0.5 text-[12px] text-muted">{m.suggestedHint}</p>
            </div>
            <ul className="flex flex-col gap-2">
              {suggestions.map((s) => (
                <SuggestionCard
                  key={s.id}
                  businessId={businessId}
                  suggestion={s}
                  chosen={chosen?.id === s.id}
                  open={chosen?.id === s.id && openId === s.id}
                  onToggle={() => toggle(s)}
                />
              ))}
            </ul>
          </section>
        )}

        {/* An opened suggestion is the scenario: the fields to build one by hand
            fold away until it is closed again, still holding its figures to adjust. */}
        <AnimatePresence initial={false}>
          {!suggestionOpen && (
            <motion.div
              key="manual"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.32, ease: EASE_OUT }}
              // Room for the fields' focus outlines, which the fold would otherwise clip.
              className="-m-1 overflow-hidden p-1"
            >
              <div className="flex flex-col gap-5">
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
                      options={categoryOptions}
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
                      <DatePicker
                        id="scenario-one-off-date"
                        value={values.oneOffDate}
                        clearable
                        onChange={(date) => set('oneOffDate', date)}
                      />
                    </Field>
                  </div>
                </fieldset>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </Sheet>
  );
}

/** Exponential ease-out: the card opens quickly and settles. */
const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/**
 * One suggestion. Closed, it is a name and a line of why; opened, it grows
 * in place to the whole reason, what it changes and what it would do to the
 * plan, worked out by the same simulation the page runs. The sheet's own Run
 * scenario runs it.
 */
function SuggestionCard({
  businessId,
  suggestion,
  chosen,
  open,
  onToggle,
}: {
  businessId: string;
  suggestion: ScenarioSuggestion;
  /** The form holds this suggestion, unchanged. */
  chosen: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const detailsId = `suggestion-${suggestion.id}`;
  const { text } = suggestion;

  return (
    <li
      className={cn(
        'rounded-control border transition-colors duration-200',
        open ? 'border-accent bg-surface' : chosen ? 'border-line-strong' : 'border-line',
      )}
    >
      <button
        type="button"
        aria-pressed={chosen}
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={onToggle}
        className={cn(
          'flex w-full cursor-pointer gap-3 rounded-control p-3 text-left transition-colors',
          !open && 'hover:bg-hover',
        )}
      >
        <span
          className={cn(
            'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-[8px] transition-colors',
            open || chosen ? 'bg-sunken text-ink' : 'bg-hover text-muted',
          )}
        >
          <Sparkles className="size-3.5" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] leading-snug font-medium text-ink">{text.name}</span>
          <span
            className={cn(
              'mt-0.5 block text-[12px] leading-snug',
              open ? 'text-ink-2' : 'line-clamp-2 text-muted',
            )}
          >
            {text.description}
          </span>
        </span>
        <ChevronDown
          aria-hidden
          strokeWidth={1.75}
          className={cn(
            'mt-1 size-4 shrink-0 text-muted transition-transform duration-300',
            open && 'rotate-180 text-ink',
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={detailsId}
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.32, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <SuggestionDetails businessId={businessId} suggestion={suggestion} />
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

/** What an opened suggestion changes and what it would do to the next 90 days. */
function SuggestionDetails({
  businessId,
  suggestion,
}: {
  businessId: string;
  suggestion: ScenarioSuggestion;
}) {
  const t = useMessages(simulationMessages);
  const s$ = t.stats;
  const m = t.builder;
  const result = useSimulation(businessId, suggestion.rule);
  const data = result.data;

  const fmt = (cents: number, sign: 'auto' | 'always' = 'auto') =>
    money(cents, { decimals: 0, sign, currency: data?.currency });
  const delta = data ? data.scenarioEndCents - data.baselineEndCents : 0;
  const stats = data && [
    {
      label: s$.withScenario,
      value: fmt(data.scenarioEndCents),
      hint: m.planWas(fmt(data.baselineEndCents)),
      tone: 'text-ink',
    },
    {
      label: s$.difference,
      value: fmt(delta, 'always'),
      hint: delta < 0 ? s$.less : s$.more,
      tone: delta < 0 ? 'text-negative' : delta > 0 ? 'text-positive' : 'text-ink',
    },
    {
      label: s$.lowest,
      value: fmt(data.scenarioLowCents),
      hint: formatDate(data.scenarioLowDate, 'd MMM yyyy'),
      tone: data.scenarioLowCents < 0 ? 'text-negative' : 'text-ink',
    },
  ];

  return (
    <div className="flex flex-col gap-3 px-3 pb-3 sm:pl-[52px]">
      {suggestion.text.assumptions.length > 0 && (
        <ul aria-label={m.changes} className="flex flex-wrap gap-1.5">
          {suggestion.text.assumptions.map((a) => (
            <li key={a}>
              <Badge>{a}</Badge>
            </li>
          ))}
        </ul>
      )}

      <section aria-label={m.impact}>
        <p className="mb-1.5 text-[12px] text-muted">{m.impact}</p>
        {result.isError ? (
          <p className="rounded-control bg-sunken px-3 py-2.5 text-[12px] text-ink-2">
            {m.impactError}
          </p>
        ) : (
          <dl
            aria-busy={!stats}
            className="grid gap-px overflow-hidden rounded-control border border-line bg-line sm:grid-cols-3"
          >
            {stats
              ? stats.map((s) => (
                  <div
                    key={s.label}
                    className="flex items-baseline justify-between gap-3 bg-sunken px-3 py-2.5 sm:block"
                  >
                    <dt className="text-[11px] text-muted">{s.label}</dt>
                    <div className="text-right sm:text-left">
                      <dd
                        className={cn(
                          'tabular text-[15px] leading-tight font-semibold tracking-[-0.01em] sm:mt-1',
                          s.tone,
                        )}
                      >
                        {s.value}
                      </dd>
                      <dd className="tabular mt-0.5 text-[11px] leading-snug text-muted">
                        {s.hint}
                      </dd>
                    </div>
                  </div>
                ))
              : [0, 1, 2].map((i) => (
                  <div key={i} className="bg-sunken px-3 py-2.5">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="mt-2 h-4 w-20" />
                    <Skeleton className="mt-1.5 h-3 w-24" />
                  </div>
                ))}
          </dl>
        )}
      </section>

      <p className="text-[12px] leading-snug text-muted">{m.adjustHint}</p>
    </div>
  );
}
