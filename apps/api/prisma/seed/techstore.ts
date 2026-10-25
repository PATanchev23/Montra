import type { Db } from '../../src/db';
import type { MembershipRole } from '../../src/generated/prisma/client';
import { hashPassword, normalizeEmail, verifyPassword } from '../../src/lib/credentials';
import type { DemoAccount, SeedConfig } from './config';

export const TECHSTORE = {
  slug: 'techstore',
  name: 'TechStore',
  currency: 'EUR',
  timezone: 'Europe/Sofia',
  industry: 'Consumer electronics',
  fiscalYearStartMonth: 1,
  lowBalanceThresholdCents: 500_000,
} as const;

export interface SeedSummary {
  businessId: string;
  accounts: { email: string; role: MembershipRole; passwordChanged: boolean }[];
}

/**
 * Seeds the TechStore business and the configured demo accounts.
 * Idempotent: every record is upserted by a natural key, and an existing
 * password hash is kept when it still matches the configured password.
 */
export async function seedDatabase(db: Db, config: SeedConfig): Promise<SeedSummary> {
  const { slug, ...details } = TECHSTORE;
  const business = await db.business.upsert({
    where: { slug },
    update: details,
    create: TECHSTORE,
  });

  const accounts: SeedSummary['accounts'] = [];
  const demo: [DemoAccount | undefined, MembershipRole][] = [
    [config.owner, 'OWNER'],
    [config.viewer, 'VIEWER'],
  ];

  for (const [account, role] of demo) {
    if (!account) continue;
    const email = normalizeEmail(account.email);
    const existing = await db.user.findUnique({ where: { email }, select: { passwordHash: true } });
    const keepHash = existing && (await verifyPassword(existing.passwordHash, account.password));
    const passwordHash = keepHash ? existing.passwordHash : await hashPassword(account.password);

    await db.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { email },
        update: { name: account.name, passwordHash },
        create: { email, name: account.name, passwordHash },
      });
      await tx.membership.upsert({
        where: { userId_businessId: { userId: user.id, businessId: business.id } },
        update: { role },
        create: { userId: user.id, businessId: business.id, role },
      });
      if (role === 'OWNER') {
        // TechStore is the result of the owner's onboarding. If the demo owner's
        // email was changed, the previous owner keeps their membership (enough
        // for access) but releases the onboarding link, which is unique per business.
        await tx.onboardingProgress.deleteMany({
          where: { businessId: business.id, userId: { not: user.id } },
        });
        await tx.onboardingProgress.upsert({
          where: { userId: user.id },
          update: { currentStep: 'REVIEW', businessId: business.id },
          create: {
            userId: user.id,
            currentStep: 'REVIEW',
            businessId: business.id,
            completedAt: new Date(),
          },
        });
        // Keep the original completion time on re-runs.
        await tx.onboardingProgress.updateMany({
          where: { userId: user.id, completedAt: null },
          data: { completedAt: new Date() },
        });
      }
    });

    accounts.push({ email, role, passwordChanged: !keepHash });
  }

  return { businessId: business.id, accounts };
}
