import type { OnboardingStatus, OnboardingStep } from '@montra/shared';

interface ProgressRow {
  currentStep: OnboardingStep;
  draft: unknown;
  completedAt: Date | null;
}

/**
 * Reads a user's OnboardingProgress row as the status the client routes on.
 * Registration creates the row up front, so "no answers saved yet" (first
 * step, empty draft) still counts as NOT_STARTED. Users without a row joined
 * an existing business and never needed onboarding.
 */
export function onboardingSummary(row: ProgressRow | null): {
  status: OnboardingStatus;
  currentStep: OnboardingStep;
} {
  if (!row) return { status: 'NOT_STARTED', currentStep: 'BUSINESS_DETAILS' };
  if (row.completedAt) return { status: 'COMPLETED', currentStep: row.currentStep };
  const nothingSaved =
    row.currentStep === 'BUSINESS_DETAILS' &&
    typeof row.draft === 'object' &&
    row.draft !== null &&
    Object.keys(row.draft).length === 0;
  return { status: nothingSaved ? 'NOT_STARTED' : 'IN_PROGRESS', currentStep: row.currentStep };
}
