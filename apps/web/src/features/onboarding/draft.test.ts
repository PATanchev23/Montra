import { onboardingDraftSchema } from '@montra/shared';
import { describe, expect, it } from 'vitest';
import {
  formValuesFrom,
  hasUnsavedChanges,
  missingAnswersFrom,
  preferencesFormSchema,
  toDraft,
} from './draft';

const saved = {
  businessDetails: {
    name: 'TechStore',
    currency: 'EUR' as const,
    timezone: 'Europe/Sofia',
  },
  financialPreferences: { fiscalYearStartMonth: 4, lowBalanceThresholdCents: 250_050 },
};

describe('onboarding draft', () => {
  it('turns a saved draft into form values and back without change', () => {
    const { details, preferences } = formValuesFrom(saved);

    expect(preferences).toEqual({ fiscalYearStartMonth: '4', lowBalanceThreshold: '2500.50' });
    expect(toDraft(details, preferences)).toEqual(saved);
    expect(hasUnsavedChanges(details, preferences, saved)).toBe(false);
  });

  it('saves only answers that are valid on their own, so the API accepts any draft', () => {
    const { details, preferences } = formValuesFrom(saved);
    const draft = toDraft(
      { ...details, name: '   ', industry: 'x'.repeat(81) },
      { ...preferences, lowBalanceThreshold: 'lots' },
    );

    expect(draft).toEqual({
      businessDetails: { currency: 'EUR', timezone: 'Europe/Sofia' },
      financialPreferences: { fiscalYearStartMonth: 4 },
    });
    expect(onboardingDraftSchema.safeParse(draft).success).toBe(true);
  });

  it('treats normalised edits as saved, and invalid ones as unsaved', () => {
    const { details, preferences } = formValuesFrom(saved);

    expect(hasUnsavedChanges({ ...details, name: ' TechStore ' }, preferences, saved)).toBe(false);
    expect(hasUnsavedChanges({ ...details, name: 'TechStore BG' }, preferences, saved)).toBe(true);
    expect(hasUnsavedChanges(details, { ...preferences, lowBalanceThreshold: '-1' }, saved)).toBe(
      true,
    );
  });

  it('starts a new draft from Montra’s defaults without counting them as changes', () => {
    const { details, preferences } = formValuesFrom({});

    expect(details.currency).toBe('EUR');
    expect(preferences).toEqual({ fiscalYearStartMonth: '1', lowBalanceThreshold: '' });
    expect(hasUnsavedChanges(details, preferences, {})).toBe(false);
  });

  it.each([
    ['', null],
    ['2500', 250_000],
    ['2500.5', 250_050],
    ['2500,50', 250_050],
    [' 0 ', 0],
  ])('reads the threshold %j as %j cents', (text, cents) => {
    expect(preferencesFormSchema.shape.lowBalanceThreshold.parse(text)).toBe(cents);
  });

  it.each([
    ['2,500.00', 'Enter an amount such as 2500 or 2500.50.'],
    ['12.345', 'Enter an amount such as 2500 or 2500.50.'],
    ['-1', 'The threshold cannot be negative.'],
    ['99999999', 'The threshold is too large.'],
    ['9'.repeat(30), 'The threshold is too large.'],
  ])('rejects the threshold %j', (text, message) => {
    const result = preferencesFormSchema.shape.lowBalanceThreshold.safeParse(text);
    expect(result.error?.issues[0]?.message).toBe(message);
  });

  it('names the answers in API error paths and the step that asks each', () => {
    expect(
      missingAnswersFrom([
        'businessDetails.name',
        'financialPreferences.lowBalanceThresholdCents',
        'businessDetails.name',
        'businessDetails',
      ]),
    ).toEqual([
      { label: 'Business name', step: 'BUSINESS_DETAILS' },
      { label: 'Low-balance threshold', step: 'FINANCIAL_PREFERENCES' },
      { label: 'Business details', step: 'BUSINESS_DETAILS' },
    ]);
  });
});
