import { DEFAULT_CURRENCY, onboardingStepSchema, type OnboardingStep } from '@montra/shared';
import { money } from '../../lib/format';
import type { SchemaForm } from '../auth/useSchemaForm';
import { preferencesFormSchema, type detailsFormSchema } from './draft';
import type { onboardingMessages } from './messages';
import { industryPresetFor, monthName, timeZoneCity } from './options';

/**
 * given: the owner answered it (typed, chose, or continued past it).
 * default: Montra's starting value on the step in front of them, not yet confirmed.
 * empty: nothing to show yet, including every answer on a step still ahead.
 */
export type RailAnswerState = 'given' | 'default' | 'empty';

export interface RailAnswer {
  label: string;
  value?: string;
  state: RailAnswerState;
}

type DetailsForm = SchemaForm<typeof detailsFormSchema>;
type PreferencesForm = SchemaForm<typeof preferencesFormSchema>;

const steps = onboardingStepSchema.options;

/**
 * The rail's answers, from the form as it stands, so they fill in as the
 * owner answers. A starting value only counts as an answer once the owner
 * chooses it or continues past its step; until then it shows as a default,
 * and answers on later steps stay blank.
 */
export function railAnswers(
  {
    details,
    preferences,
    step,
    savedStep,
  }: {
    details: Pick<DetailsForm, 'values' | 'touched'>;
    preferences: Pick<PreferencesForm, 'values' | 'touched'>;
    /** The step on screen. */
    step: OnboardingStep;
    /** Where saved progress resumes: every step before it was continued past. */
    savedStep: OnboardingStep;
  },
  copy: (typeof onboardingMessages)['en'],
): Record<OnboardingStep, RailAnswer[]> {
  const q = copy.questions;
  const reached = Math.max(steps.indexOf(step), steps.indexOf(savedStep));
  const passed = (owner: OnboardingStep) => reached > steps.indexOf(owner);
  const ahead = (owner: OnboardingStep) =>
    steps.indexOf(step) < steps.indexOf(owner) && !passed(owner);

  /** For questions Montra pre-fills (currency, time zone, month, warning). */
  function prefilled(
    owner: OnboardingStep,
    touched: boolean | undefined,
    value?: string,
  ): RailAnswer['state'] {
    if (value === undefined || (ahead(owner) && !touched)) return 'empty';
    return touched || passed(owner) ? 'given' : 'default';
  }

  const d = details.values;
  const p = preferences.values;
  const preset = industryPresetFor(d.industry);
  const threshold = preferencesFormSchema.shape.lowBalanceThreshold.safeParse(
    p.lowBalanceThreshold,
  );
  const month = Number(p.fiscalYearStartMonth);

  const name = d.name.trim() || undefined;
  const industry = preset ? copy.industries[preset].label : d.industry.trim() || undefined;
  const currency = d.currency || undefined;
  const zone = d.timezone ? timeZoneCity(d.timezone) : undefined;
  const fiscal = month >= 1 && month <= 12 ? monthName(month) : undefined;
  const warning = !threshold.success
    ? undefined
    : threshold.data == null
      ? q.noWarning
      : money(threshold.data, { currency: d.currency || DEFAULT_CURRENCY });

  return {
    BUSINESS_DETAILS: [
      // Typed answers have no starting value: shown means given.
      { label: q.name, value: name, state: name ? 'given' : 'empty' },
      { label: q.industry, value: industry, state: industry ? 'given' : 'empty' },
      {
        label: q.currency,
        value: currency,
        state: prefilled('BUSINESS_DETAILS', details.touched.currency, currency),
      },
      {
        label: q.timezone,
        value: zone,
        state: prefilled('BUSINESS_DETAILS', details.touched.timezone, zone),
      },
    ],
    FINANCIAL_PREFERENCES: [
      {
        label: q.fiscalYear,
        value: fiscal,
        state: prefilled('FINANCIAL_PREFERENCES', preferences.touched.fiscalYearStartMonth, fiscal),
      },
      {
        label: q.threshold,
        value: warning,
        state: prefilled(
          'FINANCIAL_PREFERENCES',
          preferences.touched.lowBalanceThreshold || p.lowBalanceThreshold.trim() !== '',
          warning,
        ),
      },
    ],
    REVIEW: [],
  };
}
