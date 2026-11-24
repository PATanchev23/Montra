import {
  apiErrorSchema,
  authResponseSchema,
  BUSINESS_ERROR_CODES,
  createBusinessResponseSchema,
  currentUserResponseSchema,
} from '@montra/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../src/app';
import { fixtures, useTestDb } from './db';
import { createTestApp } from './helpers';

const PASSWORD = 'correct horse battery';

type Response = Awaited<ReturnType<App['inject']>>;
const errorOf = (res: Response) => apiErrorSchema.parse(res.json()).error;

const answers = (name: string) => ({
  businessDetails: { name, industry: 'Coffee', currency: 'EUR', timezone: 'Europe/Sofia' },
  financialPreferences: { fiscalYearStartMonth: 1, bankBalanceCents: 250_000 },
});

describe('adding businesses', () => {
  const db = useTestDb();
  let app: App;

  beforeAll(async () => {
    app = await createTestApp({ AUTH_RATE_LIMIT_MAX: '1000' });
  });
  afterAll(() => app.close());

  let counter = 0;

  /** A signed-up account on `plan` that owns `owned` businesses already. */
  async function account(plan: 'FREE' | 'PRO' | 'BUSINESS', owned: number) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { name: 'Ana Petrova', email: `ana${++counter}@example.com`, password: PASSWORD },
    });
    const { user, accessToken } = authResponseSchema.parse(res.json());
    await db.user.update({ where: { id: user.id }, data: { plan } });
    for (let i = 0; i < owned; i++) {
      const business = await db.business.create({ data: fixtures.business() });
      await db.membership.create({
        data: { userId: user.id, businessId: business.id, role: 'OWNER' },
      });
    }
    return { userId: user.id, headers: { authorization: `Bearer ${accessToken}` } };
  }

  const add = (headers: Record<string, string>, name = 'Second Shop') =>
    app.inject({ method: 'POST', url: '/api/v1/businesses', headers, payload: answers(name) });

  it('lets a Pro account add a business, owned by it and listed on its profile', async () => {
    const { headers } = await account('PRO', 1);

    const res = await add(headers, 'Corner Café');
    expect(res.statusCode).toBe(201);
    const { membership } = createBusinessResponseSchema.parse(res.json());
    expect(membership.role).toBe('OWNER');
    expect(membership.business).toMatchObject({ name: 'Corner Café', currency: 'EUR' });

    const created = await db.business.findUniqueOrThrow({ where: { id: membership.business.id } });
    expect(created.cashBalanceCents).toBe(250_000);

    const me = currentUserResponseSchema.parse(
      (await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers })).json(),
    );
    expect(me.memberships.map((m) => m.business.name)).toContain('Corner Café');
    expect(me.memberships).toHaveLength(2);
  });

  it('keeps a Free account to one business', async () => {
    const { headers } = await account('FREE', 1);

    const res = await add(headers);
    expect(res.statusCode).toBe(403);
    expect(errorOf(res).code).toBe(BUSINESS_ERROR_CODES.LIMIT_REACHED);
  });

  it('stops Pro at three businesses and Business at five', async () => {
    const pro = await account('PRO', 3);
    expect((await add(pro.headers)).statusCode).toBe(403);

    const business = await account('BUSINESS', 4);
    expect((await add(business.headers)).statusCode).toBe(201);
    const sixth = await add(business.headers, 'Sixth Shop');
    expect(sixth.statusCode).toBe(403);
    expect(errorOf(sixth).message).toMatch(/up to 5 businesses/);
  });

  it('counts only owned businesses, not read-only access to others', async () => {
    const { userId, headers } = await account('PRO', 1);
    for (let i = 0; i < 2; i++) {
      const other = await db.business.create({ data: fixtures.business() });
      await db.membership.create({ data: { userId, businessId: other.id, role: 'VIEWER' } });
    }

    expect((await add(headers)).statusCode).toBe(201);
    expect(await db.membership.count({ where: { userId, role: 'OWNER' } })).toBe(2);
  });

  it('never goes over the limit when requests arrive together', async () => {
    const { userId, headers } = await account('PRO', 1);

    const results = await Promise.all([0, 1, 2, 3].map((i) => add(headers, `Rush ${i}`)));
    expect(results.filter((r) => r.statusCode === 201)).toHaveLength(2);
    expect(await db.membership.count({ where: { userId, role: 'OWNER' } })).toBe(3);
  });

  it('keeps every business after a downgrade, and only refuses adding another', async () => {
    const { userId, headers } = await account('PRO', 3);
    await db.user.update({ where: { id: userId }, data: { plan: 'FREE' } });

    const me = currentUserResponseSchema.parse(
      (await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers })).json(),
    );
    expect(me.memberships).toHaveLength(3);
    expect((await add(headers)).statusCode).toBe(403);
  });

  it('sends an account with no business of its own to onboarding first', async () => {
    const { headers } = await account('BUSINESS', 0);

    const res = await add(headers);
    expect(res.statusCode).toBe(409);
    expect(errorOf(res).code).toBe(BUSINESS_ERROR_CODES.ONBOARD_FIRST);
  });

  it('refuses incomplete answers and anonymous requests', async () => {
    const { headers } = await account('PRO', 1);
    const bad = await app.inject({
      method: 'POST',
      url: '/api/v1/businesses',
      headers,
      payload: { businessDetails: { name: '' } },
    });
    expect(bad.statusCode).toBe(400);

    const anonymous = await app.inject({
      method: 'POST',
      url: '/api/v1/businesses',
      payload: answers('Nobody'),
    });
    expect(anonymous.statusCode).toBe(401);
  });
});
