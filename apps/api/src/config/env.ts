import { normalizeEmail } from '@montra/shared';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';

/** HS256 needs a key at least as long as its 256-bit output (RFC 7518 §3.2). */
const JWT_SECRET_MIN_LENGTH = 32;
const PLACEHOLDER_SECRET = /change[-_ ]?me|replace[-_ ]?me|placeholder|example|^(.)\1+$/i;

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z
      .string()
      .regex(/^postgres(ql)?:\/\//, 'must be a postgresql:// connection string'),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:5173')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    /** Signs access tokens. Required in production; see the refinement below. */
    JWT_SECRET: z.string().optional(),
    ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    /** Attempts per IP per minute on register and login. */
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
    /** Refreshes per IP per minute; higher, as every page load refreshes once. */
    REFRESH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(30),
    /** The judges' shared demo accounts, also read by the seed. They cannot be deleted. */
    DEMO_OWNER_EMAIL: z.string().optional(),
    DEMO_VIEWER_EMAIL: z.string().optional(),
    /**
     * Stripe billing. Without a secret key the billing routes say billing is not
     * set up and the web app shows the paid plans as coming soon.
     */
    STRIPE_SECRET_KEY: z
      .string()
      .optional()
      .transform((value) => value || undefined)
      .refine((value) => value === undefined || /^(sk|rk)_(test|live)_/.test(value), {
        message: 'must be a Stripe secret or restricted key (sk_test_… or rk_test_…)',
      }),
    /** Signs the events Stripe sends to /billing/webhook (whsec_…). */
    STRIPE_WEBHOOK_SECRET: z
      .string()
      .optional()
      .transform((value) => value || undefined),
    /** The Stripe products behind the paid plans; each needs a monthly default price. */
    STRIPE_PRODUCT_PRO: z.string().default(''),
    STRIPE_PRODUCT_BUSINESS: z.string().default(''),
    /** Where the web app runs, for Stripe's return links after checkout and the portal. */
    WEB_APP_URL: z.url().default('http://localhost:5173'),
  })
  .superRefine((env, ctx) => {
    // Real charges only from a production server: anywhere else, test keys only.
    if (env.NODE_ENV !== 'production' && env.STRIPE_SECRET_KEY?.includes('_live_')) {
      ctx.addIssue({
        code: 'custom',
        path: ['STRIPE_SECRET_KEY'],
        message: 'is a live key; outside production use a test key (sk_test_…)',
      });
    }
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    const secret = env.JWT_SECRET ?? '';
    const problem =
      secret === ''
        ? 'is required in production'
        : secret.length < JWT_SECRET_MIN_LENGTH
          ? `must be at least ${JWT_SECRET_MIN_LENGTH} characters in production`
          : PLACEHOLDER_SECRET.test(secret) || new Set(secret).size < 10
            ? 'looks like a placeholder; generate a random one'
            : null;
    if (problem) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: `${problem} (e.g. node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")`,
      });
    }
  })
  .transform(({ JWT_SECRET, DEMO_OWNER_EMAIL, DEMO_VIEWER_EMAIL, ...env }) => ({
    ...env,
    // Outside production a missing secret gets a random one per process: the
    // app works with no setup, and restarts merely force a token refresh.
    JWT_SECRET: JWT_SECRET || randomBytes(48).toString('base64url'),
    /** Normalised emails of accounts that cannot be deleted; blank ones are skipped. */
    PROTECTED_ACCOUNT_EMAILS: [DEMO_OWNER_EMAIL, DEMO_VIEWER_EMAIL]
      .map((email) => normalizeEmail(email ?? ''))
      .filter(Boolean),
  }));

export type Env = z.infer<typeof envSchema>;

/** Parses and validates configuration once at startup; fails fast with a readable message. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
