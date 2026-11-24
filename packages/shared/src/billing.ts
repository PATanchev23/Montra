import { z } from 'zod';

/** Montra's plans. Mirrors the database's Plan enum, in lower case. */
export const planIdSchema = z.enum(['free', 'pro', 'business']);
export type PlanId = z.infer<typeof planIdSchema>;

/**
 * How many businesses an account may own on each plan. Only businesses the
 * account owns count; read-only access to someone else's does not. Moving to
 * a smaller plan never takes a business away: every one already owned stays
 * usable, and only adding another is refused until the account is back under
 * its plan's limit.
 */
export const BUSINESS_LIMITS: Record<PlanId, number> = { free: 1, pro: 3, business: 5 };

/** The plans that are paid for through Stripe. */
export const paidPlanIdSchema = z.enum(['pro', 'business']);
export type PaidPlanId = z.infer<typeof paidPlanIdSchema>;

/** Error codes the billing routes return, for the web app to explain. */
export const BILLING_ERROR_CODES = {
  NOT_CONFIGURED: 'BILLING_NOT_CONFIGURED',
  OWNERS_ONLY: 'BILLING_OWNERS_ONLY',
  ALREADY_SUBSCRIBED: 'ALREADY_SUBSCRIBED',
  NO_SUBSCRIPTION: 'NO_SUBSCRIPTION',
  PLAN_UNAVAILABLE: 'PLAN_UNAVAILABLE',
  PROVIDER_ERROR: 'BILLING_PROVIDER_ERROR',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
} as const;

/**
 * The signed-in account's plan. Subscriptions belong to the account, not to a
 * business: Pro covers up to three businesses and Business up to five (see
 * BUSINESS_LIMITS).
 */
export const billingResponseSchema = z.object({
  plan: planIdSchema,
  /** Stripe's subscription status (active, past_due, canceled…), or null if never subscribed. */
  status: z.string().nullable(),
  /** The subscription ends at `currentPeriodEnd` instead of renewing. */
  cancelAtPeriodEnd: z.boolean(),
  /** When the paid period ends (and renews, unless cancelled), as an ISO timestamp. */
  currentPeriodEnd: z.string().nullable(),
  /** Stripe is set up on this server; without it, paid plans are shown as coming soon. */
  configured: z.boolean(),
  /** Stripe runs with a test key: test cards only, no real money. */
  testMode: z.boolean(),
  /** Only owners of a business may subscribe. */
  canSubscribe: z.boolean(),
  /** A Stripe customer exists, so the billing portal can open. */
  canManage: z.boolean(),
});
export type BillingResponse = z.infer<typeof billingResponseSchema>;

export const checkoutRequestSchema = z.object({ plan: paidPlanIdSchema });
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

/** A Stripe-hosted page (Checkout or the billing portal) to send the browser to. */
export const billingRedirectSchema = z.object({ url: z.url() });
export type BillingRedirect = z.infer<typeof billingRedirectSchema>;
