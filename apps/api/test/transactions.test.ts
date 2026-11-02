import {
  apiErrorSchema,
  authResponseSchema,
  transactionListResponseSchema,
  transactionSchema,
  type Transaction,
} from '@montra/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../src/app';
import { fixtures, useTestDb } from './db';
import { createTestApp } from './helpers';

const PASSWORD = 'correct horse battery';

type Response = Awaited<ReturnType<App['inject']>>;
const errorOf = (res: Response) => apiErrorSchema.parse(res.json()).error;

const sale = {
  type: 'INCOME',
  amountCents: 12_990,
  description: '  Order #1001  ',
  category: ' Sales ',
  date: '2026-10-05',
};

describe('transactions API', () => {
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
      payload: { name: 'User', email: `user${++counter}@example.com`, password: PASSWORD },
    });
    const body = authResponseSchema.parse(res.json());
    return { userId: body.user.id, token: body.accessToken };
  }

  /** A business with an owner, a viewer and an outsider who belongs to another business. */
  async function setUp() {
    const business = await db.business.create({ data: fixtures.business({ name: 'Shop' }) });
    const other = await db.business.create({ data: fixtures.business({ name: 'Other' }) });
    const [owner, viewer, outsider] = [await signUp(), await signUp(), await signUp()];
    await db.membership.createMany({
      data: [
        { userId: owner.userId, businessId: business.id, role: 'OWNER' },
        { userId: viewer.userId, businessId: business.id, role: 'VIEWER' },
        { userId: outsider.userId, businessId: other.id, role: 'OWNER' },
      ],
    });
    return { business, other, owner, viewer, outsider };
  }

  let ctx: Awaited<ReturnType<typeof setUp>>;
  beforeEach(async () => {
    ctx = await setUp();
  });

  const base = (businessId: string) => `/api/v1/businesses/${businessId}/transactions`;
  const request = (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    token?: string,
    payload?: object,
  ) =>
    app.inject({
      method,
      url,
      ...(token && { headers: { authorization: `Bearer ${token}` } }),
      ...(payload && { payload }),
    });

  async function create(payload: object = sale, businessId = ctx.business.id) {
    const res = await request('POST', base(businessId), ctx.owner.token, payload);
    expect(res.statusCode).toBe(201);
    return transactionSchema.parse(res.json());
  }

  describe('create, read, update, delete', () => {
    it('creates a transaction in the business named in the path, normalising text', async () => {
      const res = await request('POST', base(ctx.business.id), ctx.owner.token, {
        ...sale,
        businessId: ctx.other.id,
        id: 'chosen-id',
        importSource: 'GENERIC_CSV',
        externalId: 'order:1',
      });

      expect(res.statusCode).toBe(201);
      const created = transactionSchema.parse(res.json());
      expect(created).toMatchObject({
        type: 'INCOME',
        amountCents: 12_990,
        description: 'Order #1001',
        category: 'Sales',
        date: '2026-10-05',
        importSource: null,
        importBatchId: null,
        externalId: null,
      });
      expect(created.id).not.toBe('chosen-id');
      expect(await db.transaction.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject({
        businessId: ctx.business.id,
      });
    });

    it('reads, updates only the given fields, and deletes', async () => {
      const created = await create();
      const url = `${base(ctx.business.id)}/${created.id}`;

      const read = await request('GET', url, ctx.owner.token);
      expect(transactionSchema.parse(read.json())).toEqual(created);

      const updated = await request('PATCH', url, ctx.owner.token, {
        amountCents: 13_500,
        type: 'EXPENSE',
      });
      expect(updated.statusCode).toBe(200);
      expect(transactionSchema.parse(updated.json())).toMatchObject({
        ...created,
        amountCents: 13_500,
        type: 'EXPENSE',
        updatedAt: expect.any(String),
      });

      expect((await request('DELETE', url, ctx.owner.token)).statusCode).toBe(204);
      expect((await request('GET', url, ctx.owner.token)).statusCode).toBe(404);
      expect((await request('DELETE', url, ctx.owner.token)).statusCode).toBe(404);
    });

    it.each([
      ['a zero amount', { amountCents: 0 }, 'amountCents'],
      ['a negative amount', { amountCents: -500 }, 'amountCents'],
      ['a fractional amount', { amountCents: 12.5 }, 'amountCents'],
      ['an amount beyond the column', { amountCents: 2_147_483_648 }, 'amountCents'],
      ['an unknown type', { type: 'TRANSFER' }, 'type'],
      ['a blank description', { description: '   ' }, 'description'],
      ['a blank category', { category: '' }, 'category'],
      ['an impossible date', { date: '2026-02-30' }, 'date'],
      ['a day-first date', { date: '05.10.2026' }, 'date'],
      ['a date long ago', { date: '1850-01-01' }, 'date'],
      ['an unsupported currency', { currency: 'BGN' }, 'currency'],
      ['a missing field', { description: undefined }, 'description'],
    ])('rejects %s', async (_label, change, path) => {
      const res = await request('POST', base(ctx.business.id), ctx.owner.token, {
        ...sale,
        ...change,
      });
      expect(res.statusCode).toBe(400);
      expect(errorOf(res)).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: expect.arrayContaining([expect.objectContaining({ path })]),
      });
      expect(await db.transaction.count()).toBe(0);
    });

    it('refuses a currency other than the business’s, rather than storing it as euros', async () => {
      const res = await request('POST', base(ctx.business.id), ctx.owner.token, {
        ...sale,
        currency: 'USD',
      });
      expect(res.statusCode).toBe(422);
      expect(errorOf(res).code).toBe('CURRENCY_MISMATCH');
      await create({ ...sale, currency: 'EUR' });
    });

    it('rejects an empty or invalid change', async () => {
      const { id } = await create();
      const url = `${base(ctx.business.id)}/${id}`;
      expect((await request('PATCH', url, ctx.owner.token, {})).statusCode).toBe(400);
      expect((await request('PATCH', url, ctx.owner.token, { amountCents: 0 })).statusCode).toBe(
        400,
      );
      expect((await request('PATCH', url, ctx.owner.token, { currency: 'USD' })).statusCode).toBe(
        422,
      );
    });
  });

  describe('history', () => {
    /** Ten transactions over three dates, two of them created on the same date. */
    async function history() {
      const made: Transaction[] = [];
      const rows: [string, 'INCOME' | 'EXPENSE', number, string][] = [
        ['2026-10-01', 'INCOME', 5000, 'Sales'],
        ['2026-10-01', 'EXPENSE', 1200, 'Advertising'],
        ['2026-10-02', 'INCOME', 9900, 'Sales'],
        ['2026-10-02', 'EXPENSE', 300, 'Fees'],
        ['2026-10-03', 'EXPENSE', 45000, 'Rent'],
        ['2026-10-03', 'INCOME', 2500, 'sales'],
        ['2026-10-04', 'EXPENSE', 800, 'Advertising'],
        ['2026-10-05', 'INCOME', 7000, 'Sales'],
        ['2026-10-05', 'INCOME', 7000, 'Sales'],
        ['2026-10-06', 'EXPENSE', 150, 'Fees'],
      ];
      for (const [date, type, amountCents, category] of rows) {
        made.push(
          await create({ date, type, amountCents, category, description: `${type} ${date}` }),
        );
      }
      // Another business's transactions never show up.
      await db.transaction.create({
        data: {
          businessId: ctx.other.id,
          type: 'INCOME',
          amountCents: 1,
          description: 'Elsewhere',
          category: 'Sales',
          date: new Date('2026-10-03'),
        },
      });
      return made;
    }

    const list = async (query = '', token = ctx.owner.token) => {
      const res = await request('GET', `${base(ctx.business.id)}${query}`, token);
      expect(res.statusCode).toBe(200);
      return transactionListResponseSchema.parse(res.json());
    };

    it('lists newest first, newest-created first within a day, 25 to a page', async () => {
      const made = await history();
      const page = await list();

      expect(page).toMatchObject({ page: 1, pageSize: 25, total: 10, pageCount: 1 });
      // `made` is in date order and creation order, so newest first is its reverse.
      expect(page.items.map((t) => t.id)).toEqual(made.map((t) => t.id).reverse());
    });

    it('pages through without overlap or gaps', async () => {
      const made = await history();
      const pages = [
        await list('?pageSize=4'),
        await list('?pageSize=4&page=2'),
        await list('?pageSize=4&page=3'),
      ];
      expect(pages.map((p) => p.items.length)).toEqual([4, 4, 2]);
      expect(pages[0]).toMatchObject({ total: 10, pageCount: 3 });
      expect(new Set(pages.flatMap((p) => p.items.map((t) => t.id))).size).toBe(made.length);
      expect((await list('?pageSize=4&page=9')).items).toEqual([]);
    });

    it('sorts by date or amount, either way', async () => {
      await history();
      expect((await list('?sort=date_asc')).items.map((t) => t.date).slice(0, 3)).toEqual([
        '2026-10-01',
        '2026-10-01',
        '2026-10-02',
      ]);
      expect((await list('?sort=amount_desc')).items[0]!.amountCents).toBe(45000);
      expect((await list('?sort=amount_asc')).items.map((t) => t.amountCents).slice(0, 2)).toEqual([
        150, 300,
      ]);
    });

    it('filters by type, category (any case) and an inclusive date range, combined', async () => {
      await history();
      expect((await list('?type=EXPENSE')).total).toBe(5);
      expect((await list('?category=SALES')).total).toBe(5);
      expect((await list('?from=2026-10-02&to=2026-10-04')).total).toBe(5);
      expect((await list('?from=2026-10-05')).total).toBe(3);
      const combined = await list('?type=INCOME&category=sales&from=2026-10-02&to=2026-10-05');
      expect(combined.items.map((t) => [t.date, t.amountCents])).toEqual([
        ['2026-10-05', 7000],
        ['2026-10-05', 7000],
        ['2026-10-03', 2500],
        ['2026-10-02', 9900],
      ]);
    });

    it.each([
      ['?pageSize=101'],
      ['?page=0'],
      ['?type=TRANSFER'],
      ['?sort=newest'],
      ['?from=2026-10-05&to=2026-10-01'],
      ['?from=yesterday'],
    ])('rejects the query %s', async (query) => {
      const res = await request('GET', `${base(ctx.business.id)}${query}`, ctx.owner.token);
      expect(res.statusCode).toBe(400);
      expect(errorOf(res).code).toBe('VALIDATION_ERROR');
    });
  });

  describe('authorization', () => {
    it('lets a viewer read but not create, change or delete', async () => {
      const created = await create();
      const url = `${base(ctx.business.id)}/${created.id}`;

      expect((await request('GET', base(ctx.business.id), ctx.viewer.token)).statusCode).toBe(200);
      expect((await request('GET', url, ctx.viewer.token)).statusCode).toBe(200);
      for (const res of [
        await request('POST', base(ctx.business.id), ctx.viewer.token, sale),
        await request('PATCH', url, ctx.viewer.token, { amountCents: 1 }),
        await request('DELETE', url, ctx.viewer.token),
        // Refused before the body is looked at.
        await request('PATCH', url, ctx.viewer.token, { amountCents: 'nonsense' }),
      ]) {
        expect(res.statusCode).toBe(403);
        expect(errorOf(res)).toMatchObject({
          code: 'FORBIDDEN',
          message: 'Only the business owner can make changes.',
        });
      }
      expect(await db.transaction.findMany()).toEqual([
        expect.objectContaining({ id: created.id, amountCents: 12_990 }),
      ]);
    });

    it('rejects requests without a valid session', async () => {
      const { id } = await create();
      const url = `${base(ctx.business.id)}/${id}`;
      for (const res of [
        await request('GET', base(ctx.business.id)),
        await request('POST', base(ctx.business.id), undefined, sale),
        await request('GET', url),
        await request('PATCH', url, undefined, { amountCents: 1 }),
        await request('DELETE', url),
        await request('GET', url, 'not-a-token'),
      ]) {
        expect(res.statusCode).toBe(401);
      }
    });

    it('hides a business from non-members, whatever they ask', async () => {
      const { id } = await create();
      const url = `${base(ctx.business.id)}/${id}`;
      for (const res of [
        await request('GET', base(ctx.business.id), ctx.outsider.token),
        await request('POST', base(ctx.business.id), ctx.outsider.token, sale),
        await request('GET', url, ctx.outsider.token),
        await request('PATCH', url, ctx.outsider.token, { amountCents: 1 }),
        await request('DELETE', url, ctx.outsider.token),
      ]) {
        expect(res.statusCode).toBe(404);
        expect(errorOf(res).message).toBe('Business not found.');
      }
      expect(await db.transaction.count()).toBe(1);
    });

    it('never reaches another business’s transaction through one’s own business', async () => {
      const theirs = await db.transaction.create({
        data: {
          businessId: ctx.other.id,
          type: 'INCOME',
          amountCents: 100,
          description: 'Theirs',
          category: 'Sales',
          date: new Date('2026-10-01'),
        },
      });
      const url = `${base(ctx.business.id)}/${theirs.id}`;
      for (const res of [
        await request('GET', url, ctx.owner.token),
        await request('PATCH', url, ctx.owner.token, { amountCents: 1 }),
        await request('DELETE', url, ctx.owner.token),
      ]) {
        expect(res.statusCode).toBe(404);
        expect(errorOf(res).message).toBe('Transaction not found.');
      }
      expect(await db.transaction.findUniqueOrThrow({ where: { id: theirs.id } })).toEqual(theirs);
    });
  });
});
