import { describe, expect, it } from 'vitest';
import { onboardingSummary } from './status';

describe('onboardingSummary', () => {
  it('treats a missing row as not started', () => {
    expect(onboardingSummary(null)).toEqual({
      status: 'NOT_STARTED',
      currentStep: 'BUSINESS_DETAILS',
    });
  });

  it('treats the row registration creates, with nothing saved, as not started', () => {
    const row = { currentStep: 'BUSINESS_DETAILS', draft: {}, completedAt: null } as const;
    expect(onboardingSummary(row).status).toBe('NOT_STARTED');
  });

  it('reports progress once answers are saved or the user has moved on', () => {
    expect(
      onboardingSummary({
        currentStep: 'BUSINESS_DETAILS',
        draft: { businessDetails: { name: 'Shop' } },
        completedAt: null,
      }),
    ).toEqual({ status: 'IN_PROGRESS', currentStep: 'BUSINESS_DETAILS' });
    expect(onboardingSummary({ currentStep: 'REVIEW', draft: {}, completedAt: null })).toEqual({
      status: 'IN_PROGRESS',
      currentStep: 'REVIEW',
    });
  });

  it('reports completion', () => {
    expect(
      onboardingSummary({ currentStep: 'REVIEW', draft: {}, completedAt: new Date() }),
    ).toEqual({ status: 'COMPLETED', currentStep: 'REVIEW' });
  });
});
