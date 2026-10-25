import { describe, expect, it } from 'vitest';
import { fixtures, useTestDb } from './db';

describe('identity and tenancy schema', () => {
  const db = useTestDb();

  async function ownerWithBusiness() {
    const user = await db.user.create({ data: fixtures.user() });
    const business = await db.business.create({ data: fixtures.business() });
    await db.membership.create({ data: { userId: user.id, businessId: business.id } });
    return { user, business };
  }

  describe('memberships', () => {
    it('default to OWNER and allow one row per user and business', async () => {
      const { user, business } = await ownerWithBusiness();
      const membership = await db.membership.findUniqueOrThrow({
        where: { userId_businessId: { userId: user.id, businessId: business.id } },
      });
      expect(membership.role).toBe('OWNER');
      await expect(
        db.membership.create({
          data: { userId: user.id, businessId: business.id, role: 'VIEWER' },
        }),
      ).rejects.toThrow();
    });

    it('let one business have an OWNER and a read-only VIEWER', async () => {
      const { business } = await ownerWithBusiness();
      const judge = await db.user.create({ data: fixtures.user() });
      await db.membership.create({
        data: { userId: judge.id, businessId: business.id, role: 'VIEWER' },
      });
      const roles = await db.membership.findMany({
        where: { businessId: business.id },
        select: { role: true },
      });
      expect(roles.map((r) => r.role).sort()).toEqual(['OWNER', 'VIEWER']);
    });
  });

  describe('cascades', () => {
    it('deleting a user removes their sessions, memberships and onboarding, not the business', async () => {
      const { user, business } = await ownerWithBusiness();
      await db.session.create({
        data: { userId: user.id, tokenHash: 'hash-1', expiresAt: new Date(Date.now() + 60_000) },
      });
      await db.onboardingProgress.create({
        data: {
          userId: user.id,
          businessId: business.id,
          completedAt: new Date(),
          currentStep: 'REVIEW',
        },
      });

      await db.user.delete({ where: { id: user.id } });

      expect(await db.session.count()).toBe(0);
      expect(await db.membership.count()).toBe(0);
      expect(await db.onboardingProgress.count()).toBe(0);
      expect(await db.business.findUnique({ where: { id: business.id } })).not.toBeNull();
    });

    it('deleting a business removes access to it and resets onboarding, not the user', async () => {
      const { user, business } = await ownerWithBusiness();
      await db.onboardingProgress.create({
        data: {
          userId: user.id,
          businessId: business.id,
          completedAt: new Date(),
          currentStep: 'REVIEW',
        },
      });

      await db.business.delete({ where: { id: business.id } });

      expect(await db.membership.count()).toBe(0);
      expect(await db.onboardingProgress.count()).toBe(0);
      expect(await db.user.findUnique({ where: { id: user.id } })).not.toBeNull();
    });
  });

  describe('constraints', () => {
    it('store emails only in normalised form, so uniqueness is case-insensitive', async () => {
      await expect(
        db.user.create({ data: fixtures.user({ email: 'Ana@Example.com' }) }),
      ).rejects.toThrow();
      await expect(
        db.user.create({ data: fixtures.user({ email: ' ana@example.com' }) }),
      ).rejects.toThrow();
      await db.user.create({ data: fixtures.user({ email: 'ana@example.com' }) });
      await expect(
        db.user.create({ data: fixtures.user({ email: 'ana@example.com' }) }),
      ).rejects.toThrow();
    });

    it('reject blank names', async () => {
      await expect(db.user.create({ data: fixtures.user({ name: '   ' }) })).rejects.toThrow();
    });

    it('keep refresh-token hashes unique and expiry after creation', async () => {
      const user = await db.user.create({ data: fixtures.user() });
      const expiresAt = new Date(Date.now() + 60_000);
      await db.session.create({ data: { userId: user.id, tokenHash: 'same', expiresAt } });
      await expect(
        db.session.create({ data: { userId: user.id, tokenHash: 'same', expiresAt } }),
      ).rejects.toThrow();
      await expect(
        db.session.create({
          data: { userId: user.id, tokenHash: 'expired', expiresAt: new Date(Date.now() - 1000) },
        }),
      ).rejects.toThrow();
    });

    it('validate business financial preferences', async () => {
      await expect(
        db.business.create({ data: { ...fixtures.business(), fiscalYearStartMonth: 13 } }),
      ).rejects.toThrow();
      await expect(
        db.business.create({ data: { ...fixtures.business(), fiscalYearStartMonth: 0 } }),
      ).rejects.toThrow();
      await expect(
        db.business.create({ data: { ...fixtures.business(), lowBalanceThresholdCents: -1 } }),
      ).rejects.toThrow();
      const business = await db.business.create({
        data: { ...fixtures.business(), fiscalYearStartMonth: 4, lowBalanceThresholdCents: 0 },
      });
      expect(business.currency).toBe('EUR');
    });
  });

  describe('onboarding progress', () => {
    it('starts empty at the first step and can be resumed from a saved draft', async () => {
      const user = await db.user.create({ data: fixtures.user() });
      const started = await db.onboardingProgress.create({ data: { userId: user.id } });
      expect(started).toMatchObject({
        currentStep: 'BUSINESS_DETAILS',
        draft: {},
        completedAt: null,
        businessId: null,
      });

      await db.onboardingProgress.update({
        where: { userId: user.id },
        data: { currentStep: 'FINANCIAL_PREFERENCES', draft: { businessName: 'Nova Gadgets' } },
      });
      const resumed = await db.onboardingProgress.findUniqueOrThrow({ where: { userId: user.id } });
      expect(resumed.currentStep).toBe('FINANCIAL_PREFERENCES');
      expect(resumed.draft).toEqual({ businessName: 'Nova Gadgets' });
    });

    it('cannot be completed without the business it created', async () => {
      const user = await db.user.create({ data: fixtures.user() });
      await expect(
        db.onboardingProgress.create({ data: { userId: user.id, completedAt: new Date() } }),
      ).rejects.toThrow();
    });

    it('keeps the draft a JSON object and links each business to one onboarding', async () => {
      const { user, business } = await ownerWithBusiness();
      await expect(
        db.onboardingProgress.create({ data: { userId: user.id, draft: ['not', 'an', 'object'] } }),
      ).rejects.toThrow();

      await db.onboardingProgress.create({
        data: { userId: user.id, businessId: business.id, completedAt: new Date() },
      });
      const other = await db.user.create({ data: fixtures.user() });
      await expect(
        db.onboardingProgress.create({
          data: { userId: other.id, businessId: business.id, completedAt: new Date() },
        }),
      ).rejects.toThrow();
    });
  });
});
