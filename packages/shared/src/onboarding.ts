import { z } from 'zod';
import {
  businessNameSchema,
  currencySchema,
  INDUSTRY_MAX_LENGTH,
  membershipSummarySchema,
  timeZoneSchema,
} from './business';

/** Mirrors the database's OnboardingStep enum, in the order the user walks through it. */
export const onboardingStepSchema = z.enum(['BUSINESS_DETAILS', 'FINANCIAL_PREFERENCES', 'REVIEW']);
export type OnboardingStep = z.infer<typeof onboardingStepSchema>;

/**
 * NOT_STARTED: no progress saved yet. IN_PROGRESS: resume at `currentStep`.
 * COMPLETED: the business has been created.
 */
export const onboardingStatusSchema = z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']);
export type OnboardingStatus = z.infer<typeof onboardingStatusSchema>;

/** Largest value a Postgres `integer` column (where cents are stored) can hold. */
const MAX_INT4 = 2_147_483_647;

export const businessDetailsSchema = z.object({
  name: businessNameSchema,
  /** Free-form business type, e.g. "Consumer electronics". Blank means not provided. */
  industry: z
    .string()
    .trim()
    .max(INDUSTRY_MAX_LENGTH, `Use at most ${INDUSTRY_MAX_LENGTH} characters.`)
    .optional(),
  currency: currencySchema,
  timezone: timeZoneSchema,
});
export type BusinessDetails = z.infer<typeof businessDetailsSchema>;

/** Every preference is optional; omitted ones fall back to the business defaults. */
export const financialPreferencesSchema = z.object({
  /** Month the financial year starts, 1 (January) to 12. */
  fiscalYearStartMonth: z
    .int('Choose a month.')
    .min(1, 'Choose a month.')
    .max(12, 'Choose a month.')
    .optional(),
  /** Warn when the projected balance drops below this many cents. Null clears it. */
  lowBalanceThresholdCents: z
    .int('Enter a whole amount in cents.')
    .min(0, 'The threshold cannot be negative.')
    .max(MAX_INT4, 'The threshold is too large.')
    .nullable()
    .optional(),
});
export type FinancialPreferences = z.infer<typeof financialPreferencesSchema>;

/**
 * Answers saved so far. Fields may be missing, but any field present must be
 * valid, so a resumed draft never holds data the final step would reject.
 */
export const onboardingDraftSchema = z.object({
  businessDetails: businessDetailsSchema.partial().optional(),
  financialPreferences: financialPreferencesSchema.optional(),
});
export type OnboardingDraft = z.infer<typeof onboardingDraftSchema>;

/** The complete answers needed to create the business. */
export const onboardingSubmissionSchema = z.object({
  businessDetails: businessDetailsSchema,
  financialPreferences: financialPreferencesSchema.optional(),
});
export type OnboardingSubmission = z.infer<typeof onboardingSubmissionSchema>;

/** Saves progress so the user can leave and resume. Replaces the previously saved draft. */
export const saveOnboardingRequestSchema = z.object({
  currentStep: onboardingStepSchema,
  draft: onboardingDraftSchema,
});
export type SaveOnboardingRequest = z.infer<typeof saveOnboardingRequestSchema>;

export const onboardingProgressSchema = z.object({
  status: onboardingStatusSchema,
  currentStep: onboardingStepSchema,
  draft: onboardingDraftSchema,
  completedAt: z.iso.datetime().nullable(),
  /** The business onboarding created; set once status is COMPLETED. */
  businessId: z.string().nullable(),
});
export type OnboardingProgress = z.infer<typeof onboardingProgressSchema>;

/**
 * Completing takes no body: the server validates the saved draft against
 * onboardingSubmissionSchema, then creates the business and OWNER membership.
 */
export const completeOnboardingResponseSchema = z.object({
  onboarding: onboardingProgressSchema,
  membership: membershipSummarySchema,
});
export type CompleteOnboardingResponse = z.infer<typeof completeOnboardingResponseSchema>;
