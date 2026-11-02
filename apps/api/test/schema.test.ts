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

  describe('transactions', () => {
    const sale = (businessId: string, overrides: object = {}) => ({
      businessId,
      type: 'INCOME' as const,
      amountCents: 1000,
      description: 'Sale',
      category: 'Sales',
      date: new Date('2026-10-01'),
      ...overrides,
    });

    it('store positive cents with a description and category', async () => {
      const { business } = await ownerWithBusiness();
      const created = await db.transaction.create({ data: sale(business.id) });
      expect(created).toMatchObject({ amountCents: 1000, importSource: null, externalId: null });

      for (const bad of [
        { amountCents: 0 },
        { amountCents: -1 },
        { description: '  ' },
        { category: '' },
        { externalId: ' ' },
      ]) {
        await expect(db.transaction.create({ data: sale(business.id, bad) })).rejects.toThrow();
      }
    });

    it('keep external ids unique within a business only', async () => {
      const { business } = await ownerWithBusiness();
      const other = await db.business.create({ data: fixtures.business() });
      await db.transaction.create({ data: sale(business.id, { externalId: 'order:1' }) });
      await expect(
        db.transaction.create({ data: sale(business.id, { externalId: 'order:1' }) }),
      ).rejects.toThrow();
      await db.transaction.create({ data: sale(other.id, { externalId: 'order:1' }) });
      // Hand-entered transactions have no external id, and any number may share that.
      await db.transaction.createMany({ data: [sale(business.id), sale(business.id)] });
      expect(await db.transaction.count({ where: { businessId: business.id } })).toBe(3);
    });

    it('say which kind of import created them', async () => {
      const { business } = await ownerWithBusiness();
      const batch = await db.importBatch.create({ data: importBatch(business.id) });
      await expect(
        db.transaction.create({ data: sale(business.id, { importBatchId: batch.id }) }),
      ).rejects.toThrow();
      await db.transaction.create({
        data: sale(business.id, { importBatchId: batch.id, importSource: 'MONTRA_TEMPLATE' }),
      });
    });
  });

  function importBatch(businessId: string, overrides: object = {}) {
    return {
      businessId,
      source: 'MONTRA_TEMPLATE' as const,
      fileFormat: 'CSV' as const,
      fileName: 'October.csv',
      fileSize: 120,
      fileSha256: 'a'.repeat(64),
      status: 'READY' as const,
      pendingData: { columns: [], rows: [] },
      expiresAt: new Date(Date.now() + 3_600_000),
      ...overrides,
    };
  }

  describe('import batches', () => {
    it('come only from the template or generic CSV and Excel files', async () => {
      const values = await db.$queryRaw<{ value: string }[]>`
        SELECT unnest(enum_range(NULL::"ImportSource"))::text AS value`;
      expect(values.map((row) => row.value)).toEqual([
        'MONTRA_TEMPLATE',
        'GENERIC_CSV',
        'GENERIC_EXCEL',
      ]);

      const { business } = await ownerWithBusiness();
      await expect(
        db.$executeRaw`
          INSERT INTO "ImportBatch" ("id", "businessId", "source", "fileFormat", "fileName",
            "fileSize", "fileSha256", "status", "expiresAt", "updatedAt")
          VALUES ('b1', ${business.id}, 'SHOPIFY', 'CSV', 'orders.csv', 1, ${'a'.repeat(64)},
            'READY', now(), now())`,
      ).rejects.toThrow();
    });

    it('account for every record once finished, with a completion time', async () => {
      const { business } = await ownerWithBusiness();
      const finished = {
        status: 'COMPLETED' as const,
        pendingData: undefined,
        totalRecords: 5,
        importedRecords: 3,
        skippedRecords: 1,
        failedRecords: 1,
        completedAt: new Date(),
      };
      await db.importBatch.create({ data: importBatch(business.id, finished) });

      for (const bad of [
        { ...finished, failedRecords: 0 },
        { ...finished, completedAt: null },
        { ...finished, pendingData: { columns: [] } },
        { importedRecords: -1 },
        { fileSha256: 'Z'.repeat(64) },
        { fileName: ' ' },
      ]) {
        await expect(
          db.importBatch.create({ data: importBatch(business.id, bad) }),
        ).rejects.toThrow();
      }
    });

    it('go with their business, but deleting one keeps its transactions', async () => {
      const { user, business } = await ownerWithBusiness();
      const batch = await db.importBatch.create({
        data: importBatch(business.id, { createdById: user.id }),
      });
      const imported = await db.transaction.create({
        data: {
          businessId: business.id,
          type: 'EXPENSE',
          amountCents: 500,
          description: 'Ads',
          category: 'Advertising',
          date: new Date('2026-10-01'),
          importBatchId: batch.id,
          importSource: 'MONTRA_TEMPLATE',
        },
      });

      await db.user.delete({ where: { id: user.id } });
      expect(await db.importBatch.findUniqueOrThrow({ where: { id: batch.id } })).toMatchObject({
        createdById: null,
      });
      await db.importBatch.delete({ where: { id: batch.id } });
      expect(await db.transaction.findUniqueOrThrow({ where: { id: imported.id } })).toMatchObject({
        importBatchId: null,
        importSource: 'MONTRA_TEMPLATE',
      });

      await db.importBatch.create({ data: importBatch(business.id) });
      await db.business.delete({ where: { id: business.id } });
      expect(await db.transaction.count()).toBe(0);
      expect(await db.importBatch.count()).toBe(0);
    });
  });
});
