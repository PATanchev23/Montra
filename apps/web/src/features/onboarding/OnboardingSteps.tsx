import {
  DEFAULT_CURRENCY,
  onboardingStepSchema,
  type OnboardingDraft,
  type OnboardingStep,
} from '@montra/shared';
import {
  AlertCircle,
  Check,
  Coffee,
  Dumbbell,
  Flower2,
  PenLine,
  Pencil,
  Scissors,
  Shirt,
  Smartphone,
  Sofa,
  type LucideIcon,
} from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { Logo } from '../../components/Logo';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useMessages } from '../../i18n';
import { cn } from '../../lib/cn';
import { money } from '../../lib/format';
import type { SchemaForm } from '../auth/useSchemaForm';
import {
  DEFAULT_FISCAL_YEAR_START_MONTH,
  preferencesFormSchema,
  type detailsFormSchema,
} from './draft';
import { INDUSTRY_PRESETS, onboardingMessages, type IndustryPreset } from './messages';
import {
  currencyChoices,
  currencyLabel,
  currencySymbol,
  financialYearAround,
  industryPresetFor,
  monthName,
  shortMonthName,
  timeZoneLabel,
} from './options';
import type { RailAnswer } from './railAnswers';
import { TimeZonePicker } from './TimeZonePicker';

const steps = onboardingStepSchema.options;

/* ── The rail ─────────────────────────────────────────────────────────────── */

/**
 * Where setup stands: the three steps, the current one in ink, and under each
 * step its questions with the answers given so far. From 1024px it is a
 * sticky rail; below that it is the page header with a three-part indicator.
 */
export function SetupRail({
  step,
  answers,
  showAnswers,
  account,
}: {
  step: OnboardingStep;
  answers: Record<OnboardingStep, RailAnswer[]>;
  showAnswers: boolean;
  /** Language, email and sign out: the header's right side, the rail's foot. */
  account: ReactNode;
}) {
  const t = useMessages(onboardingMessages);
  const currentIndex = steps.indexOf(step);

  return (
    <aside className="flex flex-wrap items-center gap-x-3 border-b border-line bg-sidebar px-5 pt-4 pb-5 sm:px-8 lg:sticky lg:top-0 lg:h-dvh lg:flex-col lg:flex-nowrap lg:items-stretch lg:overflow-y-auto lg:border-r lg:border-b-0 lg:px-7 lg:py-8">
      {/* Under 380px the mark stands alone, so language and sign out stay on one line. */}
      <div className="order-1 max-[379px]:[&_span_span]:hidden">
        <Logo />
      </div>

      <div className="order-2 ml-auto flex items-center gap-2 lg:order-3 lg:mt-auto lg:ml-0 lg:flex-col lg:items-stretch lg:gap-3 lg:border-t lg:border-line lg:pt-5">
        {account}
      </div>

      <div className="order-3 mt-5 basis-full lg:order-2 lg:mt-12">
        <p className="text-[12px] leading-4 text-muted">
          {t.stepOf(currentIndex + 1, steps.length)}
        </p>
        <ol
          aria-label={t.progress}
          className="mt-3 grid grid-cols-3 gap-2 lg:mt-5 lg:flex lg:flex-col lg:gap-1"
        >
          {steps.map((option, index) => {
            const done = index < currentIndex;
            const current = index === currentIndex;
            const copy = t.steps[option];
            return (
              <li key={option} aria-current={current ? 'step' : undefined} className="min-w-0">
                {/* Phones: a bar per step above a short name. */}
                <span
                  aria-hidden
                  className={cn(
                    'block h-[3px] rounded-[2px] transition-colors duration-300 lg:hidden',
                    done || current ? 'bg-accent' : 'bg-chart-track',
                  )}
                />
                <div className="mt-2 flex items-center gap-3 lg:mt-0 lg:py-2">
                  <span
                    aria-hidden
                    className={cn(
                      'hidden size-7 shrink-0 items-center justify-center rounded-control border text-[12px] font-medium tabular transition-colors duration-200 lg:flex',
                      current && 'border-accent bg-accent text-accent-ink',
                      done && 'border-line-strong bg-surface text-ink',
                      !done && !current && 'border-line-strong text-muted',
                    )}
                  >
                    {done ? (
                      <Check className="size-3.5" strokeWidth={2.5} />
                    ) : (
                      String(index + 1).padStart(2, '0')
                    )}
                  </span>
                  <span
                    className={cn(
                      'min-w-0 text-[12px] leading-4 lg:text-[14px] lg:leading-5',
                      current ? 'font-semibold text-ink' : done ? 'text-ink-2' : 'text-muted',
                    )}
                  >
                    <span className="lg:hidden">{copy.label}</span>
                    <span className="hidden lg:inline">{copy.name}</span>
                    {done && <span className="sr-only"> {t.done}</span>}
                  </span>
                </div>

                {showAnswers && answers[option].length > 0 && (
                  <dl className="mb-2 ml-10 hidden flex-col gap-1.5 border-l border-line pl-3 lg:flex">
                    {answers[option].map((answer) => (
                      <div
                        key={answer.label}
                        className="flex items-baseline justify-between gap-3 text-[12.5px] leading-[18px]"
                      >
                        <dt className="min-w-0 text-muted">{answer.label}</dt>
                        <dd
                          className={cn(
                            'max-w-[55%] shrink-0 text-right break-words tabular',
                            answer.state === 'given' && 'font-medium text-ink',
                            answer.state === 'default' && 'text-muted',
                            answer.state === 'empty' && 'text-faint',
                          )}
                        >
                          {answer.state === 'empty' ? (
                            <>
                              <span aria-hidden>—</span>
                              <span className="sr-only">{t.questions.notAnswered}</span>
                            </>
                          ) : (
                            <>
                              {answer.value}
                              {answer.state === 'default' && (
                                <span className="sr-only"> {t.questions.defaultValue}</span>
                              )}
                            </>
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </aside>
  );
}

/* ── Question blocks ──────────────────────────────────────────────────────── */

/**
 * One question: its title and why Montra asks on the left (above on phones),
 * the control on the right. Blocks are separated by a hairline, never boxed.
 */
function QuestionBlock({
  title,
  titleId,
  labelFor,
  description,
  descriptionId,
  optional,
  children,
}: {
  title: string;
  titleId: string;
  /** The input the title labels; radio groups reference `titleId` instead. */
  labelFor?: string;
  description: ReactNode;
  descriptionId: string;
  optional?: boolean;
  children: ReactNode;
}) {
  const t = useMessages(onboardingMessages);
  return (
    <div className="grid gap-x-10 gap-y-4 border-t border-line py-7 sm:py-8 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
      <div className="max-w-[34rem]">
        <h2 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-title text-ink">
          {labelFor ? (
            <label id={titleId} htmlFor={labelFor}>
              {title}
            </label>
          ) : (
            <span id={titleId}>{title}</span>
          )}
          {optional && <Badge>{t.optional}</Badge>}
        </h2>
        <div id={descriptionId} className="mt-1.5 text-[13px] leading-5 text-muted">
          {description}
        </div>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-2.5 flex items-start gap-1.5 text-[13px] leading-5 text-negative">
      <AlertCircle aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
      {children}
    </p>
  );
}

const textInputClass =
  'h-12 w-full min-w-0 rounded-control border border-control bg-raised px-4 text-[16px] text-ink transition-colors placeholder:text-muted hover:border-ink-2 focus:outline-none focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent aria-invalid:border-negative aria-invalid:focus-visible:outline-negative';

/** A selectable tile around a visually hidden native radio: keyboard and forms work as usual. */
const tileClass =
  'group relative flex cursor-pointer rounded-field border border-line-strong bg-surface transition-[border-color,background-color,box-shadow] duration-150 hover:border-control hover:bg-canvas has-[:checked]:border-accent has-[:checked]:bg-surface has-[:checked]:shadow-[inset_0_0_0_1px_var(--accent)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent';

/** The round selection mark: hollow until chosen, then ink with a check, so selection never rests on colour. */
function SelectionMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-[18px] shrink-0 items-center justify-center rounded-full border border-control bg-surface transition-colors duration-150 group-has-[:checked]:border-accent group-has-[:checked]:bg-accent',
        className,
      )}
    >
      <Check
        className="size-3 text-accent-ink opacity-0 transition-opacity duration-150 group-has-[:checked]:opacity-100"
        strokeWidth={3}
      />
    </span>
  );
}

/* ── Step 1: business details ─────────────────────────────────────────────── */

export function DetailsFields({ form }: { form: SchemaForm<typeof detailsFormSchema> }) {
  const id = useId();
  const t = useMessages(onboardingMessages);
  const f = t.fields;
  const nameId = `${id}-name`;
  const zoneId = `${id}-zone`;

  return (
    <div>
      <QuestionBlock
        title={f.businessName}
        titleId={`${nameId}-title`}
        labelFor={nameId}
        description={f.businessNameHint}
        descriptionId={`${nameId}-hint`}
      >
        <input
          id={nameId}
          autoComplete="organization"
          placeholder={f.businessNamePlaceholder}
          aria-invalid={form.errors.name ? true : undefined}
          aria-describedby={form.errors.name ? `${nameId}-error` : `${nameId}-hint`}
          className={textInputClass}
          {...form.register('name')}
        />
        {form.errors.name && <FieldError id={`${nameId}-error`}>{form.errors.name}</FieldError>}
      </QuestionBlock>

      <IndustryQuestion form={form} />
      <CurrencyQuestion form={form} />

      <QuestionBlock
        title={f.timeZone}
        titleId={`${zoneId}-title`}
        labelFor={zoneId}
        description={f.timeZoneHint}
        descriptionId={`${zoneId}-hint`}
      >
        <div>
          <TimeZonePicker
            id={zoneId}
            value={form.values.timezone}
            onChange={(zone) => form.setValue('timezone', zone)}
            describedBy={form.errors.timezone ? `${zoneId}-error` : `${zoneId}-hint`}
            invalid={Boolean(form.errors.timezone)}
          />
          {form.errors.timezone && (
            <FieldError id={`${zoneId}-error`}>{form.errors.timezone}</FieldError>
          )}
        </div>
      </QuestionBlock>
    </div>
  );
}

const industryIcons: Record<IndustryPreset | 'other', LucideIcon> = {
  electronics: Smartphone,
  fashion: Shirt,
  home: Sofa,
  beauty: Flower2,
  food: Coffee,
  sports: Dumbbell,
  handmade: Scissors,
  other: PenLine,
};

/**
 * What the store sells, as cards. A card saves its label as the free-text
 * industry; "Something else" opens a text field for the owner's own words.
 */
function IndustryQuestion({ form }: { form: SchemaForm<typeof detailsFormSchema> }) {
  const id = useId();
  const t = useMessages(onboardingMessages);
  const value = form.values.industry;
  const preset = industryPresetFor(value);
  const [otherChosen, setOtherChosen] = useState(() => !preset && value.trim() !== '');
  const selected: IndustryPreset | 'other' | null = preset ?? (otherChosen ? 'other' : null);
  const otherId = `${id}-other`;
  const error = form.errors.industry;

  function pick(choice: IndustryPreset | 'other') {
    if (choice === 'other') {
      setOtherChosen(true);
      // A card's label is not the owner's own description; start "Something else" empty.
      if (preset) form.setValue('industry', '');
      return;
    }
    setOtherChosen(false);
    form.setValue('industry', t.industries[choice].label);
  }

  function clear() {
    setOtherChosen(false);
    form.setValue('industry', '');
  }

  return (
    <QuestionBlock
      title={t.explain.industryTitle}
      titleId={`${id}-title`}
      description={t.explain.industry}
      descriptionId={`${id}-hint`}
      optional
    >
      <div
        role="radiogroup"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-hint`}
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {[...INDUSTRY_PRESETS, 'other' as const].map((choice) => {
          const Icon = industryIcons[choice];
          const copy = t.industries[choice];
          return (
            <label
              key={choice}
              className={cn(tileClass, 'min-h-14 items-center gap-3 px-3.5 py-2.5')}
            >
              <input
                type="radio"
                name={`${id}-industry`}
                value={choice}
                checked={selected === choice}
                onChange={() => pick(choice)}
                className="sr-only"
              />
              <Icon aria-hidden className="size-[18px] shrink-0 text-muted" strokeWidth={1.6} />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] leading-5 font-medium text-ink">
                  {copy.label}
                </span>
                <span className="mt-0.5 block text-[12px] leading-4 text-muted">
                  {copy.example}
                </span>
              </span>
              <SelectionMark />
            </label>
          );
        })}
      </div>

      {selected === 'other' && (
        <div className="mt-4">
          <label htmlFor={otherId} className="text-[13px] font-medium text-ink-2">
            {t.explain.industryOther}
          </label>
          <input
            id={otherId}
            placeholder={t.fields.industryPlaceholder}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${otherId}-error` : undefined}
            className={cn(textInputClass, 'mt-1.5')}
            {...form.register('industry')}
          />
          {error && <FieldError id={`${otherId}-error`}>{error}</FieldError>}
        </div>
      )}

      {selected && (
        <button
          type="button"
          onClick={clear}
          className="mt-3 cursor-pointer rounded-sm text-[13px] text-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t.explain.industrySkip}
        </button>
      )}
    </QuestionBlock>
  );
}

/** Every supported currency as a tile with its sign, name and code: easy to scan and compare. */
function CurrencyQuestion({ form }: { form: SchemaForm<typeof detailsFormSchema> }) {
  const id = useId();
  const t = useMessages(onboardingMessages);
  const choices = currencyChoices();

  return (
    <QuestionBlock
      title={t.fields.currency}
      titleId={`${id}-title`}
      description={
        <>
          <p>{t.fields.currencyHint}</p>
          <p className="mt-1.5">{t.explain.currencyEuro}</p>
        </>
      }
      descriptionId={`${id}-hint`}
    >
      <div
        role="radiogroup"
        aria-labelledby={`${id}-title`}
        aria-describedby={form.errors.currency ? `${id}-error` : `${id}-hint ${id}-sample`}
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {choices.map((choice) => (
          <label
            key={choice.code}
            className={cn(tileClass, 'min-h-14 items-center gap-3 px-3 py-2.5')}
          >
            <input
              type="radio"
              name="currency"
              value={choice.code}
              checked={form.values.currency === choice.code}
              onChange={() => form.setValue('currency', choice.code)}
              className="sr-only"
            />
            <span
              aria-hidden
              className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-control bg-sunken px-1.5 text-[14px] font-semibold text-ink tabular"
            >
              {choice.symbol}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] leading-5 font-medium text-ink first-letter:uppercase">
                {choice.name}
              </span>
              <span className="block text-[12px] leading-4 text-muted tabular">{choice.code}</span>
            </span>
            <SelectionMark />
          </label>
        ))}
      </div>
      {form.errors.currency ? (
        <FieldError id={`${id}-error`}>{form.errors.currency}</FieldError>
      ) : (
        <p id={`${id}-sample`} className="mt-2.5 text-[13px] leading-5 text-ink-2 tabular">
          {t.explain.currencySample(money(1_248_050, { currency: form.values.currency }))}
        </p>
      )}
    </QuestionBlock>
  );
}

/* ── Step 2: financial preferences ────────────────────────────────────────── */

export function PreferencesFields({
  form,
  currency,
}: {
  form: SchemaForm<typeof preferencesFormSchema>;
  currency: string;
}) {
  return (
    <div>
      <FiscalYearQuestion form={form} />
      <BalanceQuestion form={form} currency={currency} />
      <ThresholdQuestion form={form} currency={currency} />
    </div>
  );
}

/** Twelve months as a grid, with the financial year it makes spelled out beneath. */
function FiscalYearQuestion({ form }: { form: SchemaForm<typeof preferencesFormSchema> }) {
  const id = useId();
  const t = useMessages(onboardingMessages);
  const month = Number(form.values.fiscalYearStartMonth) || DEFAULT_FISCAL_YEAR_START_MONTH;
  const year = financialYearAround(month);

  return (
    <QuestionBlock
      title={t.fields.fiscalYear}
      titleId={`${id}-title`}
      description={
        <>
          <p>{t.fields.fiscalYearHint}</p>
          <p className="mt-1.5">{t.explain.fiscalCalendar}</p>
        </>
      }
      descriptionId={`${id}-hint`}
    >
      <div
        role="radiogroup"
        aria-labelledby={`${id}-title`}
        aria-describedby={form.errors.fiscalYearStartMonth ? `${id}-error` : `${id}-span`}
        className="grid grid-cols-4 gap-1.5 sm:grid-cols-6"
      >
        {Array.from({ length: 12 }, (_, index) => {
          const value = index + 1;
          return (
            <label
              key={value}
              className="group relative flex h-11 cursor-pointer items-center justify-center rounded-control border border-line-strong bg-surface text-[14px] font-medium text-ink-2 transition-colors duration-150 hover:border-control hover:bg-canvas hover:text-ink has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-accent-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
            >
              <input
                type="radio"
                name="fiscalYearStartMonth"
                value={String(value)}
                checked={month === value}
                onChange={() => form.setValue('fiscalYearStartMonth', String(value))}
                className="sr-only"
              />
              <span aria-hidden className="first-letter:uppercase">
                {shortMonthName(value)}
              </span>
              <span className="sr-only">{monthName(value)}</span>
            </label>
          );
        })}
      </div>

      <div id={`${id}-span`} className="mt-5">
        <div aria-hidden className="flex gap-1">
          {Array.from({ length: 12 }, (_, index) => (
            <span
              key={index}
              className={cn(
                'h-1.5 flex-1 rounded-[2px] transition-colors duration-300',
                index === year.monthOf - 1
                  ? 'bg-accent'
                  : index < year.monthOf
                    ? 'bg-line-strong'
                    : 'bg-chart-track',
              )}
            />
          ))}
        </div>
        <p className="mt-2.5 text-[13px] leading-5 text-ink-2 tabular">
          {t.explain.fiscalSpan(year.range)}{' '}
          <span className="text-muted">{t.explain.fiscalMonth(year.monthOf)}</span>
        </p>
      </div>
      {form.errors.fiscalYearStartMonth && (
        <FieldError id={`${id}-error`}>{form.errors.fiscalYearStartMonth}</FieldError>
      )}
    </QuestionBlock>
  );
}

/** Today's bank balance: where every balance and projection starts. */
function BalanceQuestion({
  form,
  currency,
}: {
  form: SchemaForm<typeof preferencesFormSchema>;
  currency: string;
}) {
  const t = useMessages(onboardingMessages);
  return (
    <AmountQuestion
      form={form}
      field="bankBalance"
      currency={currency}
      title={t.explain.balanceTitle}
      hint={t.fields.balanceHint}
      placeholder={t.explain.balancePlaceholder}
      preview={(cents) =>
        cents == null ? t.explain.balanceOff : t.explain.balancePreview(money(cents, { currency }))
      }
    />
  );
}

/** The low-balance warning, written out as you type. */
function ThresholdQuestion({
  form,
  currency,
}: {
  form: SchemaForm<typeof preferencesFormSchema>;
  currency: string;
}) {
  const t = useMessages(onboardingMessages);
  return (
    <AmountQuestion
      form={form}
      field="lowBalanceThreshold"
      currency={currency}
      title={t.explain.thresholdTitle}
      hint={t.fields.thresholdHint}
      placeholder={t.explain.thresholdPlaceholder}
      preview={(cents) =>
        cents == null
          ? t.explain.thresholdOff
          : t.explain.thresholdPreview(money(cents, { currency }))
      }
    />
  );
}

/** An optional amount in the business currency, with what it means written out below. */
function AmountQuestion({
  form,
  field,
  currency,
  title,
  hint,
  placeholder,
  preview,
}: {
  form: SchemaForm<typeof preferencesFormSchema>;
  field: 'bankBalance' | 'lowBalanceThreshold';
  currency: string;
  title: string;
  hint: string;
  placeholder: string;
  preview: (cents: number | null) => string;
}) {
  const id = useId();
  const inputId = `${id}-amount`;
  const error = form.errors[field];
  const parsed = preferencesFormSchema.shape[field].safeParse(form.values[field]);
  const symbol = currencySymbol(currency);

  return (
    <QuestionBlock
      title={title}
      titleId={`${id}-title`}
      labelFor={inputId}
      description={hint}
      descriptionId={`${id}-hint`}
      optional
    >
      <div className="max-w-[22rem]">
        <div className="flex h-12 items-stretch overflow-hidden rounded-control border border-control bg-raised transition-colors hover:border-ink-2 has-[:focus-visible]:border-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-accent has-[[aria-invalid=true]]:border-negative has-[[aria-invalid=true]:focus-visible]:outline-negative">
          <span
            aria-hidden
            className="flex min-w-12 items-center justify-center border-r border-line bg-sunken px-3 text-[15px] font-semibold text-ink-2 tabular"
          >
            {symbol}
          </span>
          <input
            id={inputId}
            inputMode="decimal"
            autoComplete="off"
            placeholder={placeholder}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${inputId}-error` : `${id}-hint ${inputId}-preview`}
            className="min-w-0 flex-1 bg-transparent px-3.5 text-[16px] font-medium text-ink tabular placeholder:font-normal placeholder:text-muted focus:outline-none"
            {...form.register(field)}
          />
          <span
            aria-hidden
            className="flex items-center pr-3.5 text-[13px] font-medium text-muted tabular"
          >
            {currency}
          </span>
        </div>
        {error ? (
          <FieldError id={`${inputId}-error`}>{error}</FieldError>
        ) : (
          <p id={`${inputId}-preview`} className="mt-2.5 text-[13px] leading-5 text-ink-2">
            {preview(parsed.success ? parsed.data : null)}
          </p>
        )}
      </div>
    </QuestionBlock>
  );
}

/* ── Step 3: review ───────────────────────────────────────────────────────── */

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
  const balance = preferences.bankBalanceCents;
  const t = useMessages(onboardingMessages);
  const f = t.fields;
  const m = t.review;
  const missing = (
    <span className="inline-flex items-center gap-1.5 font-medium text-negative">
      <AlertCircle aria-hidden className="size-3.5" strokeWidth={2} />
      {m.missing}
    </span>
  );

  const sections: { step: OnboardingStep; title: string; rows: [string, ReactNode][] }[] = [
    {
      step: 'BUSINESS_DETAILS',
      title: m.businessDetails,
      rows: [
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
          m.balance,
          balance == null
            ? m.noBalance
            : money(balance, { currency: details.currency ?? DEFAULT_CURRENCY }),
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
    <div className="flex flex-col gap-10 border-t border-line pt-8">
      <div className="max-w-[40rem] rounded-panel border border-panel-line bg-surface shadow-panel">
        <div className="px-5 pt-5 pb-6 sm:px-6">
          <p className="text-[12px] leading-4 text-muted">{f.businessName}</p>
          <p className="mt-1.5 text-figure-sm break-words text-ink">{details.name || missing}</p>
          <p className="mt-1 text-[14px] text-ink-2">
            {details.industry || <span className="text-muted">{m.noIndustry}</span>}
          </p>
        </div>

        {sections.map((section) => (
          <section
            key={section.step}
            aria-label={section.title}
            className="border-t border-line px-5 py-4 sm:px-6"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[14px] font-semibold text-ink">{section.title}</h2>
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
            <dl className="mt-1 text-[14px]">
              {section.rows.map(([label, value]) => (
                <div
                  key={label}
                  className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 border-t border-line-soft py-2.5 first:border-t-0"
                >
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-right break-words text-ink tabular">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <section aria-labelledby="onboarding-next" className="max-w-[40rem]">
        <h2 id="onboarding-next" className="text-[14px] font-semibold text-ink">
          {m.nextTitle}
        </h2>
        <ol className="mt-3 flex flex-col">
          {m.next.map((line, index) => (
            <li
              key={line}
              className="flex items-baseline gap-3.5 border-t border-line-soft py-3 text-[14px] leading-5 text-ink-2 first:border-t-0"
            >
              <span className="w-5 shrink-0 text-[12px] font-medium text-muted tabular">
                {String(index + 1).padStart(2, '0')}
              </span>
              {line}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
