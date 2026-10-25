import { z } from 'zod';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../src/lib/credentials';

/** Unset and blank values both mean "not configured". */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    schema.optional(),
  );

const demoEnvSchema = z
  .object({
    DEMO_OWNER_EMAIL: optional(z.email()),
    DEMO_OWNER_PASSWORD: optional(z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH)),
    DEMO_OWNER_NAME: optional(z.string().trim().min(1)),
    DEMO_VIEWER_EMAIL: optional(z.email()),
    DEMO_VIEWER_PASSWORD: optional(z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH)),
    DEMO_VIEWER_NAME: optional(z.string().trim().min(1)),
  })
  .superRefine((env, ctx) => {
    for (const role of ['OWNER', 'VIEWER'] as const) {
      const email = env[`DEMO_${role}_EMAIL`];
      const password = env[`DEMO_${role}_PASSWORD`];
      if (Boolean(email) !== Boolean(password)) {
        ctx.addIssue({
          code: 'custom',
          path: [`DEMO_${role}_${email ? 'PASSWORD' : 'EMAIL'}`],
          message: `Set both DEMO_${role}_EMAIL and DEMO_${role}_PASSWORD, or neither`,
        });
      }
    }
    if (
      env.DEMO_OWNER_EMAIL &&
      env.DEMO_OWNER_EMAIL.toLowerCase() === env.DEMO_VIEWER_EMAIL?.toLowerCase()
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['DEMO_VIEWER_EMAIL'],
        message: 'Must differ from DEMO_OWNER_EMAIL',
      });
    }
  });

export interface DemoAccount {
  email: string;
  password: string;
  name: string;
}

export interface SeedConfig {
  owner?: DemoAccount;
  viewer?: DemoAccount;
}

/** Reads demo credentials from the environment. Accounts that are not configured are skipped. */
export function loadSeedConfig(source: NodeJS.ProcessEnv = process.env): SeedConfig {
  const result = demoEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid demo account configuration:\n${z.prettifyError(result.error)}`);
  }
  const env = result.data;
  return {
    owner:
      env.DEMO_OWNER_EMAIL && env.DEMO_OWNER_PASSWORD
        ? {
            email: env.DEMO_OWNER_EMAIL,
            password: env.DEMO_OWNER_PASSWORD,
            name: env.DEMO_OWNER_NAME ?? 'TechStore Owner',
          }
        : undefined,
    viewer:
      env.DEMO_VIEWER_EMAIL && env.DEMO_VIEWER_PASSWORD
        ? {
            email: env.DEMO_VIEWER_EMAIL,
            password: env.DEMO_VIEWER_PASSWORD,
            name: env.DEMO_VIEWER_NAME ?? 'Competition Judge',
          }
        : undefined,
  };
}
