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
  .transform(({ JWT_SECRET, ...env }) => ({
    ...env,
    // Outside production a missing secret gets a random one per process: the
    // app works with no setup, and restarts merely force a token refresh.
    JWT_SECRET: JWT_SECRET || randomBytes(48).toString('base64url'),
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
