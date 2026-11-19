import {
  alertsResponseSchema,
  apiErrorSchema,
  authResponseSchema,
  budgetMonthResponseSchema,
  budgetRecommendationSchema,
  cashFlowResponseSchema,
  cashSettingsSchema,
  isoAddDays,
  isoShiftMonth,
  reportResponseSchema,
  scenarioPresetsResponseSchema,
  simulationResponseSchema,
  todayIn,
} from '@montra/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../src/app';
import { fixtures, useTestDb } from './db';
import { createTestApp } from './helpers';

const PASSWORD = 'correct horse battery';

/*
 * The finance endpoints, end to end: rows in the database, figures out of the
 * shared engine (whose maths has its own tests in packages/shared), and who
 * may read or change what.
 */

describe('finance API', () => {
  const db = useTestDb();
  let app: App;
  let counter = 0;
  const today = todayIn('Europe/Sofia');

  beforeAll(async () => {
    app = await createTestApp({ AUTH_RATE_LIMIT_MAX: '1000' });
  });
  afterAll(() => app.close());

  async function signUp() {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { name: 'User', email: `fin${++counter}@example.com`, password: PASSWORD },
    });
    const body = authResponseSchema.parse(res.json());
    return { userId: body.user.id, token: body.accessToken };
  }

  let business: { id: string };
  let owner: { token: string };
  let viewer: { token: string };
  let outsider: { token: string };

  beforeEach(async () => {
    business = await db.business.create({ data: fixtures.business({ name: 'Shop' }) });
    const other = await db.business.create({ data: fixtures.business({ name: 'Other' }) });
    const [o, v, x] = [await signUp(), await signUp(), await signUp()];
    [owner, viewer, outsider] = [o, v, x];
    await db.membership.createMany({
      data: [
        { userId: o.userId, businessId: business.id, role: 'OWNER' },
        { userId: v.userId, businessId: business.id, role: 'VIEWER' },
        { userId: x.userId, businessId: other.id, role: 'OWNER' },
      ],
    });
  });

  /** Rent on the 1st of each of the last four months, and a sale every week. */
  async function seedShop() {
    const rows = [];
    for (let m = -4; m <= -1; m++) {
      rows.push({
        type: 'EXPENSE' as const,
        amountCents: 100_000,
        category: 'Rent',
        description: 'Office rent',
        date: isoShiftMonth(today, m),
      });
    }
    for (let d = 0; d < 120; d += 7) {
      rows.push({
        type: 'INCOME' as const,
        amountCents: 50_000,
        category: 'Sales',
        description: `Invoice ${d}`,
        date: isoAddDays(today, -d),
      });
    }
    await db.transaction.createMany({
      data: rows.map((r) => ({
        ...r,
        businessId: business.id,
        date: new Date(`${r.date}T00:00:00Z`),
      })),
    });
  }

  const call = (method: 'GET' | 'PUT', path: string, token = owner.token, payload?: object) =>
    app.inject({
      method,
      url: `/api/v1/businesses/${business.id}${path}`,
      headers: { authorization: `Bearer ${token}` },
      ...(payload && { payload }),
    });

  async function ok<T>(
    res: Awaited<ReturnType<App['inject']>>,
    schema: { parse: (v: unknown) => T },
  ) {
    expect(res.statusCode, res.body).toBe(200);
    return schema.parse(res.json());
  }

  const code = (res: Awaited<ReturnType<App['inject']>>) =>
    apiErrorSchema.parse(res.json()).error.code;

  describe('GET /cash-flow', () => {
    it('computes the business’s own figures and its next recurring payment', async () => {
      await seedShop();

      const flow = await ok(await call('GET', '/cash-flow'), cashFlowResponseSchema);

      expect(flow.today).toBe(today);
      expect(flow.currency).toBe('EUR');
      expect(flow.transactionCount).toBe(4 + 18);
      expect(flow.months).toHaveLength(15);
      expect(flow.stats.incomeCents).toBeGreaterThan(0);
      expect(flow.upcoming.find((u) => u.description === 'Office rent')).toMatchObject({
        dueDate: isoShiftMonth(today, 1),
        type: 'EXPENSE',
        amountCents: 100_000,
        certainty: 'scheduled',
      });
      // Without a bank balance, the ledger starts at zero.
      expect(flow.settings.balanceCents).toBeNull();
    });

    it('is all zero for a business with no transactions', async () => {
      const flow = await ok(await call('GET', '/cash-flow'), cashFlowResponseSchema);
      expect(flow.transactionCount).toBe(0);
      expect(flow.upcoming).toEqual([]);
      expect(flow.stats.projectedCents).toBe(0);
    });

    it('is open to viewers and hidden from outsiders', async () => {
      expect((await call('GET', '/cash-flow', viewer.token)).statusCode).toBe(200);
      const res = await call('GET', '/cash-flow', outsider.token);
      expect(res.statusCode).toBe(404);
      expect(code(res)).toBe('NOT_FOUND');
    });
  });

  describe('PUT /cash-settings', () => {
    it('records today’s bank balance, which the cash flow then starts from', async () => {
      await seedShop();

      const saved = await ok(
        await call('PUT', '/cash-settings', owner.token, {
          balanceCents: 2_500_000,
          lowBalanceThresholdCents: 500_000,
        }),
        cashSettingsSchema,
      );
      expect(saved).toEqual({
        balanceCents: 2_500_000,
        balanceDate: today,
        lowBalanceThresholdCents: 500_000,
      });

      const flow = await ok(await call('GET', '/cash-flow'), cashFlowResponseSchema);
      expect(flow.stats.closingCents).toBe(2_500_000);
      expect(flow.settings).toEqual(saved);
    });

    it('forgets the balance when sent null', async () => {
      await call('PUT', '/cash-settings', owner.token, {
        balanceCents: 1_000,
        lowBalanceThresholdCents: null,
      });
      await call('PUT', '/cash-settings', owner.token, {
        balanceCents: null,
        lowBalanceThresholdCents: null,
      });
      expect(await db.business.findUniqueOrThrow({ where: { id: business.id } })).toMatchObject({
        cashBalanceCents: null,
        cashBalanceDate: null,
      });
    });

    it('refuses viewers and a negative threshold', async () => {
      const body = { balanceCents: 1_000, lowBalanceThresholdCents: null };
      const asViewer = await call('PUT', '/cash-settings', viewer.token, body);
      expect(asViewer.statusCode).toBe(403);
      expect(code(asViewer)).toBe('FORBIDDEN');

      const negative = await call('PUT', '/cash-settings', owner.token, {
        balanceCents: 1_000,
        lowBalanceThresholdCents: -1,
      });
      expect(negative.statusCode).toBe(400);
    });
  });

  describe('budgets', () => {
    it('saves limits and compares this month’s spending with them', async () => {
      await seedShop();
      const put = await call('PUT', '/budgets', owner.token, {
        limits: [
          { category: ' rent ', limitCents: 120_000 },
          { category: 'Marketing', limitCents: 30_000 },
        ],
      });
      expect(put.statusCode, put.body).toBe(200);

      const month = await ok(
        await call('GET', `/budgets?month=${isoShiftMonth(today, -1).slice(0, 7)}`),
        budgetMonthResponseSchema,
      );
      expect(month.isCurrent).toBe(false);
      expect(month.lines.find((l) => l.category === 'rent')).toMatchObject({
        limitCents: 120_000,
        spentCents: 100_000,
      });
      expect(month.totalLimitCents).toBe(150_000);
      // The editor lists the budgeted categories and those with spending.
      expect(month.categories.map((c) => c.category).sort()).toEqual(['Marketing', 'rent']);
    });

    it('replaces every limit on each save', async () => {
      await call('PUT', '/budgets', owner.token, { limits: [{ category: 'Rent', limitCents: 1 }] });
      await call('PUT', '/budgets', owner.token, { limits: [{ category: 'Ads', limitCents: 2 }] });
      expect(await db.budget.findMany({ select: { category: true } })).toEqual([
        { category: 'Ads' },
      ]);
    });

    it('recommends a budget from the history, for viewers too', async () => {
      await seedShop();
      // Spending in the four months before this one, for the median.
      await db.transaction.createMany({
        data: [-4, -3, -2, -1].map((m) => ({
          businessId: business.id,
          type: 'EXPENSE' as const,
          amountCents: 20_000,
          category: 'Ads',
          description: `Campaign ${m}`,
          date: new Date(`${isoShiftMonth(today, m).slice(0, 8)}10T00:00:00Z`),
        })),
      });

      const plan = await ok(
        await call('GET', '/budgets/recommendation?goal=save-10', viewer.token),
        budgetRecommendationSchema,
      );
      expect(plan.goal).toBe('save-10');
      expect(plan.lines.find((l) => l.category === 'Rent')).toMatchObject({
        limitCents: 100_000,
        fixed: true,
      });
      expect(plan.lines.map((l) => l.category)).toContain('Ads');
      expect(plan.targetCents).toBe(Math.round(plan.expectedIncomeCents * 0.9));

      expect((await call('GET', '/budgets/recommendation?goal=save-50')).statusCode).toBe(400);
    });

    it('refuses the same category twice, a future month, and viewers', async () => {
      const twice = await call('PUT', '/budgets', owner.token, {
        limits: [
          { category: 'Rent', limitCents: 1 },
          { category: 'RENT', limitCents: 2 },
        ],
      });
      expect(twice.statusCode).toBe(400);

      const future = await call('GET', `/budgets?month=${isoShiftMonth(today, 1).slice(0, 7)}`);
      expect(future.statusCode).toBe(400);

      const asViewer = await call('PUT', '/budgets', viewer.token, { limits: [] });
      expect(asViewer.statusCode).toBe(403);
      expect((await call('GET', '/budgets', viewer.token)).statusCode).toBe(200);
    });
  });

  describe('simulations', () => {
    it('offers presets sized to the business and runs a rule from the query string', async () => {
      await seedShop();
      const { presets } = await ok(
        await call('GET', '/simulations'),
        scenarioPresetsResponseSchema,
      );
      expect(presets.map((p) => p.id)).toContain('income-drop');

      const run = await ok(
        await call('GET', '/simulations/run?monthlyCostCents=100000', viewer.token),
        simulationResponseSchema,
      );
      expect(run.scenarioEndCents).toBeLessThan(run.baselineEndCents);
      expect(run.months).toHaveLength(3);
    });

    it('refuses a half-described rule', async () => {
      const res = await call('GET', '/simulations/run?category=Rent');
      expect(res.statusCode).toBe(400);
      expect(code(res)).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /reports', () => {
    it('reports the year by category, with the years that have data', async () => {
      await seedShop();
      const year = Number(today.slice(0, 4));
      const report = await ok(await call('GET', `/reports?year=${year}`), reportResponseSchema);

      expect(report.year).toBe(year);
      expect(report.asOf).toBe(today);
      expect(report.months).toHaveLength(12);
      expect(report.rows.map((r) => r.category)).toEqual(expect.arrayContaining(['Sales']));
      expect(report.years[0]).toBe(year);
      expect((await call('GET', `/reports?year=${year + 1}`)).statusCode).toBe(400);
    });
  });

  describe('GET /alerts', () => {
    it('warns when this month’s spending passes a budget', async () => {
      await db.transaction.create({
        data: {
          businessId: business.id,
          type: 'EXPENSE',
          amountCents: 9_000,
          category: 'Ads',
          description: 'Campaign',
          date: new Date(`${today}T00:00:00Z`),
        },
      });
      await call('PUT', '/budgets', owner.token, {
        limits: [{ category: 'ads', limitCents: 5_000 }],
      });

      const { alerts } = await ok(await call('GET', '/alerts', viewer.token), alertsResponseSchema);
      expect(alerts).toEqual([
        { kind: 'over-budget', category: 'ads', spentCents: 9_000, limitCents: 5_000 },
      ]);
    });
  });

  it('removes the budgets with the business', async () => {
    await call('PUT', '/budgets', owner.token, { limits: [{ category: 'Rent', limitCents: 1 }] });
    await db.business.delete({ where: { id: business.id } });
    expect(await db.budget.count()).toBe(0);
  });
});
