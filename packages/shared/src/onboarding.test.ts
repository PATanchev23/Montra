import { describe, expect, it } from 'vitest';
import {
  businessResponseSchema,
  canonicalTimeZone,
  currencySchema,
  membershipSummarySchema,
  timeZoneSchema,
} from './business';
import {
  businessDetailsSchema,
  completeOnboardingResponseSchema,
  financialPreferencesSchema,
  onboardingDraftSchema,
  onboardingProgressSchema,
  onboardingSubmissionSchema,
  saveOnboardingRequestSchema,
} from './onboarding';

const details = {
  name: 'TechStore',
  industry: 'Consumer electronics',
  currency: 'EUR',
  timezone: 'Europe/Sofia',
};

describe('business fields', () => {
  it('accepts supported currencies only, in upper case', () => {
    expect(currencySchema.safeParse('EUR').success).toBe(true);
    expect(currencySchema.safeParse('USD').success).toBe(true);
    expect(currencySchema.safeParse('eur').success).toBe(false);
    expect(currencySchema.safeParse('BTC').success).toBe(false);
  });

  it('accepts IANA time zones and stores their canonical spelling', () => {
    expect(timeZoneSchema.parse(' europe/sofia ')).toBe('Europe/Sofia');
    expect(timeZoneSchema.parse('UTC')).toBe('UTC');
    expect(canonicalTimeZone('America/New_York')).toBe('America/New_York');
  });

  it.each(['', 'Mars/Olympus_Mons', 'Europe', 'GMT+25'])('rejects time zone %j', (timezone) => {
    expect(timeZoneSchema.safeParse(timezone).success).toBe(false);
  });

  it('describes a membership as a role plus the business', () => {
    const membership = {
      role: 'VIEWER',
      business: {
        id: 'biz_1',
        slug: 'techstore',
        name: 'TechStore',
        currency: 'EUR',
        timezone: 'Europe/Sofia',
      },
    };
    expect(membershipSummarySchema.parse(membership)).toEqual(membership);
    expect(membershipSummarySchema.safeParse({ ...membership, role: 'owner' }).success).toBe(false);
  });
});

describe('businessResponseSchema', () => {
  const response = {
    role: 'OWNER',
    business: {
      id: 'biz_1',
      slug: 'techstore',
      name: 'TechStore',
      currency: 'EUR',
      timezone: 'Europe/Sofia',
      industry: null,
      fiscalYearStartMonth: 4,
      lowBalanceThresholdCents: null,
    },
  };

  it('describes a business with its onboarding settings and the caller’s role', () => {
    expect(businessResponseSchema.parse(response)).toEqual(response);
  });

  it('rejects settings the database would not hold', () => {
    const withBusiness = (overrides: object) => ({
      ...response,
      business: { ...response.business, ...overrides },
    });
    expect(
      businessResponseSchema.safeParse(withBusiness({ fiscalYearStartMonth: 0 })).success,
    ).toBe(false);
    expect(
      businessResponseSchema.safeParse(withBusiness({ lowBalanceThresholdCents: -5 })).success,
    ).toBe(false);
  });
});

describe('businessDetailsSchema', () => {
  it('accepts complete details and trims text', () => {
    expect(
      businessDetailsSchema.parse({
        ...details,
        name: '  TechStore ',
        industry: ' Consumer electronics ',
      }),
    ).toEqual(details);
  });

  it('treats industry as optional', () => {
    const { industry: _industry, ...withoutIndustry } = details;
    expect(businessDetailsSchema.safeParse(withoutIndustry).success).toBe(true);
  });

  it('requires a non-blank name of at most 100 characters', () => {
    expect(businessDetailsSchema.safeParse({ ...details, name: '   ' }).success).toBe(false);
    expect(businessDetailsSchema.safeParse({ ...details, name: 'a'.repeat(100) }).success).toBe(
      true,
    );
    expect(businessDetailsSchema.safeParse({ ...details, name: 'a'.repeat(101) }).success).toBe(
      false,
    );
  });

  it('caps industry at 80 characters', () => {
    expect(businessDetailsSchema.safeParse({ ...details, industry: 'a'.repeat(81) }).success).toBe(
      false,
    );
  });
});

describe('financialPreferencesSchema', () => {
  it('accepts no preferences at all', () => {
    expect(financialPreferencesSchema.parse({})).toEqual({});
  });

  it('accepts a fiscal start month from 1 to 12', () => {
    for (const month of [1, 12]) {
      expect(financialPreferencesSchema.safeParse({ fiscalYearStartMonth: month }).success).toBe(
        true,
      );
    }
    for (const month of [0, 13, 4.5, '4']) {
      expect(financialPreferencesSchema.safeParse({ fiscalYearStartMonth: month }).success).toBe(
        false,
      );
    }
  });

  it('takes the low-balance threshold as whole, non-negative cents that fit the column', () => {
    const parse = (lowBalanceThresholdCents: unknown) =>
      financialPreferencesSchema.safeParse({ lowBalanceThresholdCents }).success;
    expect(parse(0)).toBe(true);
    expect(parse(500_000)).toBe(true);
    expect(parse(null)).toBe(true);
    expect(parse(2_147_483_647)).toBe(true);
    expect(parse(2_147_483_648)).toBe(false);
    expect(parse(-1)).toBe(false);
    expect(parse(12.5)).toBe(false);
  });
});

describe('onboardingDraftSchema', () => {
  it('accepts an empty draft, as stored for a brand-new row', () => {
    expect(onboardingDraftSchema.parse({})).toEqual({});
  });

  it('accepts partially completed steps', () => {
    const draft = { businessDetails: { name: 'TechStore' } };
    expect(onboardingDraftSchema.parse(draft)).toEqual(draft);
  });

  it('still validates the fields that are present', () => {
    expect(onboardingDraftSchema.safeParse({ businessDetails: { currency: 'BTC' } }).success).toBe(
      false,
    );
    expect(
      onboardingDraftSchema.safeParse({ financialPreferences: { fiscalYearStartMonth: 13 } })
        .success,
    ).toBe(false);
  });

  it('drops unknown keys rather than storing them', () => {
    expect(onboardingDraftSchema.parse({ businessDetails: {}, injected: true })).toEqual({
      businessDetails: {},
    });
  });
});

describe('saveOnboardingRequestSchema', () => {
  it('requires a known step', () => {
    expect(
      saveOnboardingRequestSchema.safeParse({ currentStep: 'FINANCIAL_PREFERENCES', draft: {} })
        .success,
    ).toBe(true);
    expect(saveOnboardingRequestSchema.safeParse({ currentStep: 'DONE', draft: {} }).success).toBe(
      false,
    );
    expect(saveOnboardingRequestSchema.safeParse({ draft: {} }).success).toBe(false);
  });
});

describe('onboardingSubmissionSchema', () => {
  it('accepts complete business details with or without preferences', () => {
    expect(onboardingSubmissionSchema.safeParse({ businessDetails: details }).success).toBe(true);
    expect(
      onboardingSubmissionSchema.safeParse({
        businessDetails: details,
        financialPreferences: { fiscalYearStartMonth: 4, lowBalanceThresholdCents: 100_000 },
      }).success,
    ).toBe(true);
  });

  it('rejects a draft that is still missing required details', () => {
    const result = onboardingSubmissionSchema.safeParse({ businessDetails: { name: 'TechStore' } });
    expect(result.error?.issues.map((issue) => issue.path.join('.')).sort()).toEqual([
      'businessDetails.currency',
      'businessDetails.timezone',
    ]);
  });
});

describe('onboarding responses', () => {
  const inProgress = {
    status: 'IN_PROGRESS',
    currentStep: 'FINANCIAL_PREFERENCES',
    draft: { businessDetails: details },
    completedAt: null,
    businessId: null,
  };

  it('describes progress that can be resumed', () => {
    expect(onboardingProgressSchema.parse(inProgress)).toEqual(inProgress);
  });

  it('requires completedAt to be an ISO timestamp', () => {
    expect(
      onboardingProgressSchema.safeParse({ ...inProgress, completedAt: 'yesterday' }).success,
    ).toBe(false);
  });

  it('returns the completed progress and the new OWNER membership', () => {
    const completed = {
      onboarding: {
        ...inProgress,
        status: 'COMPLETED',
        currentStep: 'REVIEW',
        completedAt: '2026-10-26T10:00:00.000Z',
        businessId: 'biz_1',
      },
      membership: {
        role: 'OWNER',
        business: {
          id: 'biz_1',
          slug: 'techstore-x7k2',
          name: 'TechStore',
          currency: 'EUR',
          timezone: 'Europe/Sofia',
        },
      },
    };
    expect(completeOnboardingResponseSchema.parse(completed)).toEqual(completed);
  });
});
