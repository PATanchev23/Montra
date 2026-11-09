import {
  apiErrorSchema,
  authResponseSchema,
  dashboardResponseSchema,
  isoAddDays,
  todayIn,
  type DashboardResponse,
} from '@montra/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../src/app';
import { fixtures, useTestDb } from './db';
import { createTestApp } from './helpers';

const PASSWORD = 'correct horse battery';

type Row = [date: string, type: 'INCOME' | 'EXPENSE', cents: number, category: string];

describe('dashboard API', () => {
  const db = useTestDb();
  let app: App;
  let counter = 0;

  beforeAll(async () => {
    app = await createTestApp({ AUTH_RATE_LIMIT_MAX: '1000' });
  });
  afterAll(() => app.close());

  async function signUp() {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { name: 'User', email: `dash${++counter}@example.com`, password: PASSWORD },
    });
    const body = authResponseSchema.parse(res.json());
    return { userId: body.user.id, token: body.accessToken };
  }

  let business: { id: string };
  let other: { id: string };
  let owner: { token: string };
  let viewer: { token: string };
  let outsider: { token: string };

  beforeEach(async () => {
    business = await db.business.create({ data: fixtures.business({ name: 'Shop' }) });
    other = await db.business.create({ data: fixtures.business({ name: 'Other' }) });
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

  async function seed(rows: Row[], businessId = business.id) {
    await db.transaction.createMany({
      data: rows.map(([date, type, amountCents, category], i) => ({
        businessId,
        type,
        amountCents,
        category,
        description: `${type} ${i}`,
        date: new Date(`${date}T00:00:00Z`),
      })),
    });
  }

  const request = (query: string, token = owner.token, businessId = business.id) =>
    app.inject({
      method: 'GET',
      url: `/api/v1/businesses/${businessId}/dashboard${query}`,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  async function dashboard(query: string, token = owner.token): Promise<DashboardResponse> {
    const res = await request(query, token);
    expect(res.statusCode, res.body).toBe(200);
    return dashboardResponseSchema.parse(res.json());
  }

  const october = '?period=custom&from=2026-10-01&to=2026-10-31';

  describe('figures', () => {
    beforeEach(async () => {
      await seed([
        // September: the comparison period for October (30 days before it).
        ['2026-09-05', 'INCOME', 100_000, 'Sales'],
        ['2026-09-20', 'EXPENSE', 40_000, 'Rent'],
        // October.
        ['2026-10-01', 'INCOME', 125_000, 'Sales'],
        ['2026-10-02', 'EXPENSE', 31_045, 'Advertising'],
        ['2026-10-02', 'EXPENSE', 4_280, 'advertising'],
        ['2026-10-13', 'EXPENSE', 80_000, 'Rent'],
        ['2026-10-14', 'INCOME', 9_999, 'Sales'],
        ['2026-10-31', 'EXPENSE', 1, 'Fees'],
        // Outside both periods.
        ['2026-11-01', 'INCOME', 777_777, 'Sales'],
      ]);
      // Another business's money never counts.
      await seed([['2026-10-10', 'INCOME', 5_000_000, 'Sales']], other.id);
    });

    it('totals income, expenses and net, compared with the period before', async () => {
      const result = await dashboard(october);

      expect(result.currency).toBe('EUR');
      expect(result.period).toEqual({
        period: 'custom',
        from: '2026-10-01',
        to: '2026-10-31',
        days: 31,
        previousFrom: '2026-08-31',
        previousTo: '2026-09-30',
      });
      expect(result.overview).toEqual({
        income: {
          cents: 134_999,
          previousCents: 100_000,
          changeCents: 34_999,
          changeRatio: 0.34999,
        },
        expenses: {
          cents: 115_326,
          previousCents: 40_000,
          changeCents: 75_326,
          changeRatio: 1.88315,
        },
        net: {
          cents: 19_673,
          previousCents: 60_000,
          changeCents: -40_327,
          changeRatio: expect.closeTo(-40_327 / 60_000, 12),
        },
        transactionCount: 6,
        previousTransactionCount: 2,
      });
    });

    it('groups the trend by day, without gaps, matching the overview', async () => {
      const { trend, overview } = await dashboard(october);

      expect(trend.interval).toBe('day');
      expect(trend.points).toHaveLength(31);
      expect(trend.points[1]).toEqual({
        start: '2026-10-02',
        end: '2026-10-02',
        incomeCents: 0,
        expenseCents: 35_325,
        netCents: -35_325,
      });
      const sum = (key: 'incomeCents' | 'expenseCents') =>
        trend.points.reduce((total, point) => total + point[key], 0);
      expect(sum('incomeCents')).toBe(overview.income.cents);
      expect(sum('expenseCents')).toBe(overview.expenses.cents);
    });

    it('groups longer periods by week and by month', async () => {
      const weeks = await dashboard('?period=custom&from=2026-09-01&to=2026-10-31');
      expect(weeks.trend.interval).toBe('week');
      expect(weeks.trend.points[0]).toMatchObject({ start: '2026-09-01', end: '2026-09-07' });
      expect(weeks.trend.points.at(-1)).toMatchObject({ start: '2026-10-27', end: '2026-10-31' });

      const months = await dashboard('?period=custom&from=2026-06-15&to=2026-11-30');
      expect(months.trend.interval).toBe('month');
      expect(months.trend.points.map((p) => [p.start, p.incomeCents, p.expenseCents])).toEqual([
        ['2026-06-15', 0, 0],
        ['2026-07-01', 0, 0],
        ['2026-08-01', 0, 0],
        ['2026-09-01', 100_000, 40_000],
        ['2026-10-01', 134_999, 115_326],
        ['2026-11-01', 777_777, 0],
      ]);
    });

    it('breaks expenses down by category, merging case, with shares adding up to 100%', async () => {
      const { expenseBreakdown } = await dashboard(october);
      expect(expenseBreakdown).toEqual({
        totalCents: 115_326,
        items: [
          { category: 'Rent', cents: 80_000, shareBasisPoints: 6937, transactionCount: 1 },
          // Equally used spellings: the first alphabetically, as on the Transactions page.
          { category: 'advertising', cents: 35_325, shareBasisPoints: 3063, transactionCount: 2 },
          { category: 'Fees', cents: 1, shareBasisPoints: 0, transactionCount: 1 },
        ],
      });
    });

    it('lists the latest transactions whatever the period', async () => {
      const { recent } = await dashboard(october);
      expect(recent.map((t) => t.date)).toEqual([
        '2026-11-01',
        '2026-10-31',
        '2026-10-14',
        '2026-10-13',
        '2026-10-02',
        '2026-10-02',
      ]);
      expect(recent.map((t) => t.amountCents)).not.toContain(5_000_000);
    });

    it('agrees with the database', async () => {
      const { overview } = await dashboard(october);
      const where = {
        businessId: business.id,
        date: { gte: new Date('2026-10-01'), lte: new Date('2026-10-31') },
      };
      const [income, expenses] = await Promise.all([
        db.transaction.aggregate({
          where: { ...where, type: 'INCOME' },
          _sum: { amountCents: true },
        }),
        db.transaction.aggregate({
          where: { ...where, type: 'EXPENSE' },
          _sum: { amountCents: true },
        }),
      ]);
      expect(overview.income.cents).toBe(income._sum.amountCents);
      expect(overview.expenses.cents).toBe(expenses._sum.amountCents);
      expect(overview.transactionCount).toBe(await db.transaction.count({ where }));
    });
  });

  it('sums the remaining categories as one once there are more than six', async () => {
    await seed(
      ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((category, i): Row => [
        '2026-10-05',
        'EXPENSE',
        (7 - i) * 1_000,
        category,
      ]),
    );
    const { expenseBreakdown } = await dashboard(october);
    expect(expenseBreakdown.items.map((i) => [i.category, i.cents, i.transactionCount])).toEqual([
      ['A', 7_000, 1],
      ['B', 6_000, 1],
      ['C', 5_000, 1],
      ['D', 4_000, 1],
      ['E', 3_000, 1],
      [null, 3_000, 2],
    ]);
    expect(expenseBreakdown.items.reduce((sum, i) => sum + i.shareBasisPoints, 0)).toBe(10_000);
  });

  it('counts rolling periods back from today in the business’s time zone', async () => {
    const today = todayIn('Europe/Sofia');
    await seed([
      [today, 'INCOME', 5_000, 'Sales'],
      [isoAddDays(today, -6), 'EXPENSE', 1_000, 'Fees'],
      [isoAddDays(today, -7), 'EXPENSE', 2_000, 'Fees'],
      [isoAddDays(today, 1), 'INCOME', 9_000, 'Sales'],
    ]);
    const week = await dashboard('?period=7d');
    expect(week.today).toBe(today);
    expect(week.period).toMatchObject({ from: isoAddDays(today, -6), to: today, days: 7 });
    expect(week.overview.income.cents).toBe(5_000);
    expect(week.overview.expenses).toMatchObject({ cents: 1_000, previousCents: 2_000 });
    expect(week.overview.expenses.changeRatio).toBe(-0.5);

    // The default period is the last 30 days.
    expect((await dashboard('')).period).toMatchObject({ period: '30d', days: 30 });
  });

  it('reports zeros, not errors, for a business without transactions', async () => {
    const result = await dashboard('?period=month');
    const zero = { cents: 0, previousCents: 0, changeCents: 0, changeRatio: null };
    expect(result.overview).toEqual({
      income: zero,
      expenses: zero,
      net: zero,
      transactionCount: 0,
      previousTransactionCount: 0,
    });
    expect(result.expenseBreakdown).toEqual({ totalCents: 0, items: [] });
    expect(result.recent).toEqual([]);
    expect(result.trend.points.every((p) => p.incomeCents === 0 && p.expenseCents === 0)).toBe(
      true,
    );
  });

  it('uses the business currency', async () => {
    await db.business.update({ where: { id: business.id }, data: { currency: 'USD' } });
    expect((await dashboard('')).currency).toBe('USD');
  });

  describe('access', () => {
    it('lets owners and viewers read, and hides the business from everyone else', async () => {
      await seed([['2026-10-05', 'INCOME', 1_000, 'Sales']]);
      expect((await dashboard(october, viewer.token)).overview.income.cents).toBe(1_000);

      for (const res of [
        await request(october, outsider.token),
        await request(october, owner.token, other.id),
        await request(october, owner.token, 'no-such-business'),
      ]) {
        expect(res.statusCode).toBe(404);
        expect(apiErrorSchema.parse(res.json()).error.message).toBe('Business not found.');
      }
      expect((await request(october, '')).statusCode).toBe(401);
      expect((await request(october, 'not-a-token')).statusCode).toBe(401);
    });

    it.each([
      ['?period=year'],
      ['?period=custom'],
      ['?period=custom&from=2026-10-31&to=2026-10-01'],
      ['?period=custom&from=2010-01-01&to=2026-10-01'],
      ['?period=30d&from=2026-10-01'],
      ['?period=custom&from=yesterday&to=2026-10-01'],
    ])('rejects the query %s', async (query) => {
      const res = await request(query);
      expect(res.statusCode).toBe(400);
      expect(apiErrorSchema.parse(res.json()).error.code).toBe('VALIDATION_ERROR');
    });
  });
});
