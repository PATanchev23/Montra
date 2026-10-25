import { describe, expect, it } from 'vitest';
import { loadSeedConfig, type SeedConfig } from '../prisma/seed/config';
import { seedDatabase, TECHSTORE } from '../prisma/seed/techstore';
import { verifyPassword } from '../src/lib/credentials';
import { useTestDb } from './db';

const config: SeedConfig = {
  owner: { email: 'Demo@TechStore.example', password: 'owner-password-1', name: 'Presiyan' },
  viewer: {
    email: 'judge@techstore.example',
    password: 'viewer-password-1',
    name: 'Competition Judge',
  },
};

describe('TechStore seed', () => {
  const db = useTestDb();

  it('creates the business, an OWNER with completed onboarding, and a read-only VIEWER', async () => {
    const summary = await seedDatabase(db, config);

    const business = await db.business.findUniqueOrThrow({ where: { slug: TECHSTORE.slug } });
    expect(business).toMatchObject({
      id: summary.businessId,
      name: 'TechStore',
      fiscalYearStartMonth: 1,
    });

    const owner = await db.user.findUniqueOrThrow({
      where: { email: 'demo@techstore.example' },
      include: { memberships: true, onboarding: true },
    });
    expect(owner.memberships).toEqual([
      expect.objectContaining({ businessId: business.id, role: 'OWNER' }),
    ]);
    expect(owner.onboarding).toMatchObject({ businessId: business.id, currentStep: 'REVIEW' });
    expect(owner.onboarding?.completedAt).toBeInstanceOf(Date);
    expect(await verifyPassword(owner.passwordHash, 'owner-password-1')).toBe(true);

    const viewer = await db.user.findUniqueOrThrow({
      where: { email: 'judge@techstore.example' },
      include: { memberships: true, onboarding: true },
    });
    expect(viewer.memberships).toEqual([
      expect.objectContaining({ businessId: business.id, role: 'VIEWER' }),
    ]);
    expect(viewer.onboarding).toBeNull();
  });

  it('is safe to run repeatedly', async () => {
    const first = await seedDatabase(db, config);
    const ownerBefore = await db.user.findUniqueOrThrow({
      where: { email: 'demo@techstore.example' },
      include: { onboarding: true },
    });

    const second = await seedDatabase(db, config);
    const ownerAfter = await db.user.findUniqueOrThrow({
      where: { email: 'demo@techstore.example' },
      include: { onboarding: true },
    });

    expect(second.businessId).toBe(first.businessId);
    expect(second.accounts.every((a) => !a.passwordChanged)).toBe(true);
    expect(ownerAfter.passwordHash).toBe(ownerBefore.passwordHash);
    expect(ownerAfter.onboarding?.completedAt).toEqual(ownerBefore.onboarding?.completedAt);
    expect(await db.business.count()).toBe(1);
    expect(await db.user.count()).toBe(2);
    expect(await db.membership.count()).toBe(2);
  });

  it('rotates a demo password when the configured value changes', async () => {
    await seedDatabase(db, config);
    const result = await seedDatabase(db, {
      ...config,
      viewer: { ...config.viewer!, password: 'a-brand-new-password' },
    });
    const viewer = await db.user.findUniqueOrThrow({ where: { email: 'judge@techstore.example' } });
    expect(result.accounts.find((a) => a.role === 'VIEWER')?.passwordChanged).toBe(true);
    expect(await verifyPassword(viewer.passwordHash, 'a-brand-new-password')).toBe(true);
    expect(await verifyPassword(viewer.passwordHash, 'viewer-password-1')).toBe(false);
  });

  it('preserves an existing TechStore record and only creates accounts that are configured', async () => {
    const existing = await db.business.create({ data: { slug: 'techstore', name: 'TechStore' } });
    const summary = await seedDatabase(db, {});
    expect(summary.businessId).toBe(existing.id);
    expect(summary.accounts).toEqual([]);
    expect(await db.user.count()).toBe(0);
  });
});

describe('demo account configuration', () => {
  it('reads accounts from the environment and treats blanks as unset', () => {
    const parsed = loadSeedConfig({
      DEMO_OWNER_EMAIL: 'demo@techstore.example',
      DEMO_OWNER_PASSWORD: 'owner-password-1',
      DEMO_VIEWER_EMAIL: '',
      DEMO_VIEWER_PASSWORD: '',
    });
    expect(parsed.owner).toEqual({
      email: 'demo@techstore.example',
      password: 'owner-password-1',
      name: 'TechStore Owner',
    });
    expect(parsed.viewer).toBeUndefined();
  });

  it('rejects half-configured accounts, short passwords and a shared email', () => {
    expect(() => loadSeedConfig({ DEMO_OWNER_EMAIL: 'demo@techstore.example' })).toThrow(
      /DEMO_OWNER_PASSWORD/,
    );
    expect(() =>
      loadSeedConfig({
        DEMO_VIEWER_EMAIL: 'judge@techstore.example',
        DEMO_VIEWER_PASSWORD: 'short',
      }),
    ).toThrow(/DEMO_VIEWER_PASSWORD/);
    expect(() =>
      loadSeedConfig({
        DEMO_OWNER_EMAIL: 'same@techstore.example',
        DEMO_OWNER_PASSWORD: 'owner-password-1',
        DEMO_VIEWER_EMAIL: 'Same@TechStore.example',
        DEMO_VIEWER_PASSWORD: 'viewer-password-1',
      }),
    ).toThrow(/differ/);
  });
});
