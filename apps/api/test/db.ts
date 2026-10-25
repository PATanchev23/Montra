import { afterAll, beforeEach } from 'vitest';
import { createDb, type Db } from '../src/db';

/**
 * A Prisma client on the test database, emptied before every test.
 * Test files run one at a time (see vitest.config.ts), so truncation is safe.
 */
export function useTestDb(): Db {
  const db = createDb(process.env.DATABASE_URL!);
  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE "OnboardingProgress", "Membership", "Session", "User", "Business" CASCADE',
    );
  });
  afterAll(() => db.$disconnect());
  return db;
}

let counter = 0;

/** Minimal valid rows; override only what a test cares about. */
export const fixtures = {
  user: (overrides: { email?: string; name?: string } = {}) => ({
    email: overrides.email ?? `user${++counter}@example.com`,
    name: overrides.name ?? 'Test User',
    passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$placeholder',
  }),
  business: (overrides: { slug?: string; name?: string } = {}) => ({
    slug: overrides.slug ?? `business-${++counter}`,
    name: overrides.name ?? 'Test Business',
  }),
};
