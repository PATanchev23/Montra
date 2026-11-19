import {
  businessDetailsSchema,
  canonicalTimeZone,
  DEFAULT_CURRENCY,
  DEFAULT_TIMEZONE,
  financialPreferencesSchema,
  fromCents,
  toCents,
  type BusinessDetails,
  type FinancialPreferences,
  type OnboardingDraft,
  type OnboardingStep,
} from '@montra/shared';
import { z } from 'zod';

import { messagesFor } from '../../i18n';
import { onboardingMessages } from './messages';
/*
 * The onboarding form holds answers as typed (strings); the API stores them
 * as an OnboardingDraft. Both directions go through the shared schemas, so
 * the browser accepts exactly what the API does.
 */

/** The business default when no month is chosen (Business.fiscalYearStartMonth). */
export const DEFAULT_FISCAL_YEAR_START_MONTH = 1;

const AMOUNT_PATTERN = /^-?\d+(?:[.,]\d{1,2})?$/;

/** The low-balance threshold as typed, in whole currency units. Blank means no warning. */
const thresholdTextSchema = z
  .string()
  .trim()
  .transform((text, ctx) => {
    if (text === '') return null;
    if (!AMOUNT_PATTERN.test(text)) {
      ctx.addIssue({ code: 'custom', message: 'Enter an amount such as 2500 or 2500.50.' });
      return z.NEVER;
    }
    const cents = toCents(Number(text.replace(',', '.')));
    // Far beyond the largest threshold; the shared schema reports it as too large.
    return Number.isSafeInteger(cents) ? cents : Number.MAX_SAFE_INTEGER;
  })
  .pipe(financialPreferencesSchema.shape.lowBalanceThresholdCents.unwrap());

/**
 * The bank balance as typed, in whole currency units; a leading minus (or −)
 * means overdrawn. Blank means not given.
 */
const balanceTextSchema = z
  .string()
  .trim()
  .transform((text, ctx) => {
    if (text === '') return null;
    const compact = text.replace(/\s/g, '').replace('−', '-');
    if (!AMOUNT_PATTERN.test(compact)) {
      ctx.addIssue({ code: 'custom', message: 'Enter an amount such as 2500 or 2500.50.' });
      return z.NEVER;
    }
    const cents = toCents(Number(compact.replace(',', '.')));
    // Far beyond the largest balance; the shared schema reports it as too large.
    return Number.isSafeInteger(cents) ? cents : Number.MAX_SAFE_INTEGER;
  })
  .pipe(financialPreferencesSchema.shape.bankBalanceCents.unwrap());

const monthTextSchema = z
  .string()
  .transform(Number)
  .pipe(financialPreferencesSchema.shape.fiscalYearStartMonth.unwrap());

/** The business details step: the shared schema already takes text. */
export const detailsFormSchema = businessDetailsSchema;

/** The financial preferences step, as typed. */
export const preferencesFormSchema = z.object({
  fiscalYearStartMonth: monthTextSchema,
  bankBalance: balanceTextSchema,
  lowBalanceThreshold: thresholdTextSchema,
});

export type DetailsValues = Record<keyof z.input<typeof detailsFormSchema>, string>;
export type PreferencesValues = Record<keyof z.input<typeof preferencesFormSchema>, string>;

/** This device's time zone when it is a valid IANA zone, else Montra's default. */
export function defaultTimeZone(): string {
  return canonicalTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone) ?? DEFAULT_TIMEZONE;
}

/** Whole units without a fraction where there is none: 250000 → "2500", 250050 → "2500.50". */
function amountText(cents: number): string {
  return cents % 100 === 0 ? String(fromCents(cents)) : fromCents(cents).toFixed(2);
}

const optionalAmountText = (cents: number | null | undefined) =>
  cents == null ? '' : amountText(cents);

/** The saved draft as form values. Unanswered questions start from Montra's defaults. */
export function formValuesFrom(draft: OnboardingDraft): {
  details: DetailsValues;
  preferences: PreferencesValues;
} {
  const details = draft.businessDetails ?? {};
  const preferences = draft.financialPreferences ?? {};
  return {
    details: {
      name: details.name ?? '',
      industry: details.industry ?? '',
      currency: details.currency ?? DEFAULT_CURRENCY,
      timezone: details.timezone ?? defaultTimeZone(),
    },
    preferences: {
      fiscalYearStartMonth: String(
        preferences.fiscalYearStartMonth ?? DEFAULT_FISCAL_YEAR_START_MONTH,
      ),
      bankBalance: optionalAmountText(preferences.bankBalanceCents),
      lowBalanceThreshold: optionalAmountText(preferences.lowBalanceThresholdCents),
    },
  };
}

/** The draft the form would save, and how many answers are too invalid to save. */
function collect(details: DetailsValues, preferences: PreferencesValues) {
  let rejected = 0;
  const businessDetails: Partial<BusinessDetails> = {};
  for (const name of Object.keys(detailsFormSchema.shape) as (keyof DetailsValues)[]) {
    if (details[name].trim() === '') continue;
    const parsed = detailsFormSchema.shape[name].safeParse(details[name]);
    if (parsed.success) Object.assign(businessDetails, { [name]: parsed.data });
    else rejected++;
  }

  const financialPreferences: FinancialPreferences = {};
  const month = monthTextSchema.safeParse(preferences.fiscalYearStartMonth);
  if (month.success) financialPreferences.fiscalYearStartMonth = month.data;
  else rejected++;
  const balance = balanceTextSchema.safeParse(preferences.bankBalance);
  if (balance.success) financialPreferences.bankBalanceCents = balance.data;
  else rejected++;
  const threshold = thresholdTextSchema.safeParse(preferences.lowBalanceThreshold);
  if (threshold.success) financialPreferences.lowBalanceThresholdCents = threshold.data;
  else rejected++;

  return { draft: { businessDetails, financialPreferences } satisfies OnboardingDraft, rejected };
}

/**
 * The answers to save: every one that is valid on its own, normalised.
 * Blank and invalid answers are left out, so the API always accepts the
 * draft, even when the user goes back from a half-finished step.
 */
export function toDraft(details: DetailsValues, preferences: PreferencesValues): OnboardingDraft {
  return collect(details, preferences).draft;
}

/** Whether the form holds answers the saved draft does not. An invalid answer always counts. */
export function hasUnsavedChanges(
  details: DetailsValues,
  preferences: PreferencesValues,
  saved: OnboardingDraft,
): boolean {
  const current = collect(details, preferences);
  const baseline = formValuesFrom(saved);
  return (
    current.rejected > 0 ||
    JSON.stringify(current.draft) !==
      JSON.stringify(toDraft(baseline.details, baseline.preferences))
  );
}

export interface MissingAnswer {
  label: string;
  step: OnboardingStep;
}

/** Reads the `path`s of a validation error's details as answers and the steps that ask them. */
export function missingAnswersFrom(paths: string[]): MissingAnswer[] {
  const answerLabels = messagesFor(onboardingMessages).answers;
  const seen = new Set<string>();
  const answers: MissingAnswer[] = [];
  for (const path of paths) {
    const label = answerLabels[path] ?? answerLabels.businessDetails!;
    if (seen.has(label)) continue;
    seen.add(label);
    answers.push({
      label,
      step: path.startsWith('financialPreferences') ? 'FINANCIAL_PREFERENCES' : 'BUSINESS_DETAILS',
    });
  }
  return answers;
}
