import { z } from 'zod';
import { DEFAULT_CURRENCY } from './money';

/** Mirrors the database's MembershipRole enum. */
export const membershipRoleSchema = z.enum(['OWNER', 'VIEWER']);
export type MembershipRole = z.infer<typeof membershipRoleSchema>;

export const BUSINESS_NAME_MAX_LENGTH = 100;
export const INDUSTRY_MAX_LENGTH = 80;
export const DEFAULT_TIMEZONE = 'Europe/Sofia';

/** Currencies a business can report in. EUR is the default (Bulgaria joined the euro in 2026). */
export const SUPPORTED_CURRENCIES = [
  DEFAULT_CURRENCY,
  'USD',
  'GBP',
  'CHF',
  'CZK',
  'DKK',
  'HUF',
  'NOK',
  'PLN',
  'RON',
  'SEK',
] as const;

export const currencySchema = z.enum(SUPPORTED_CURRENCIES, {
  error: 'Choose a supported currency.',
});
export type Currency = z.infer<typeof currencySchema>;

/** Returns the canonical IANA name (e.g. "europe/sofia" → "Europe/Sofia"), or null if unknown. */
export function canonicalTimeZone(value: string): string | null {
  if (value === '') return null;
  try {
    return new Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

export const timeZoneSchema = z
  .string()
  .trim()
  .max(64)
  .refine((value) => canonicalTimeZone(value) !== null, { error: 'Choose a valid time zone.' })
  .overwrite((value) => canonicalTimeZone(value) ?? value);

export const businessNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter the business name.')
  .max(BUSINESS_NAME_MAX_LENGTH, `Use at most ${BUSINESS_NAME_MAX_LENGTH} characters.`);

/** A business as seen by one of its members. */
export const businessSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  currency: currencySchema,
  timezone: z.string(),
});
export type BusinessSummary = z.infer<typeof businessSummarySchema>;

/** One business the current user can open, and what they may do there. */
export const membershipSummarySchema = z.object({
  role: membershipRoleSchema,
  business: businessSummarySchema,
});
export type MembershipSummary = z.infer<typeof membershipSummarySchema>;

/** A business with the settings chosen during onboarding. */
export const businessProfileSchema = businessSummarySchema.extend({
  industry: z.string().nullable(),
  /** Month the financial year starts, 1 (January) to 12. */
  fiscalYearStartMonth: z.int().min(1).max(12),
  /** Warn when the projected balance drops below this many cents; null means no warning. */
  lowBalanceThresholdCents: z.int().min(0).nullable(),
});
export type BusinessProfile = z.infer<typeof businessProfileSchema>;

/** GET /businesses/:businessId: the business, and the caller's role in it. */
export const businessResponseSchema = z.object({
  role: membershipRoleSchema,
  business: businessProfileSchema,
});
export type BusinessResponse = z.infer<typeof businessResponseSchema>;
