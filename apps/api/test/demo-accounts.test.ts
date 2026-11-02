import {
  apiErrorSchema,
  authResponseSchema,
  businessResponseSchema,
  completeOnboardingResponseSchema,
  currentUserResponseSchema,
} from '@montra/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadSeedConfig } from '../prisma/seed/config';
import { seedDatabase, TECHSTORE } from '../prisma/seed/techstore';
import type { App } from '../src/app';
import { fixtures, useTestDb } from './db';
import { createTestApp } from './helpers';
import { REFRESH_COOKIE } from '../src/modules/auth/routes';

/*
 * The two accounts judges use, seeded exactly as `npm run db:seed` does,
 * exercised through the HTTP API: what each can open, and that the viewer
 * cannot change anything by calling the API directly.
 */

const OWNER = { email: 'owner@demo.example', password: 'owner-demo-password' };
const VIEWER = { email: 'viewer@demo.example', password: 'viewer-demo-password' };

const config = loadSeedConfig({
  DEMO_OWNER_EMAIL: OWNER.email,
  DEMO_OWNER_PASSWORD: OWNER.password,
  DEMO_VIEWER_EMAIL: VIEWER.email,
  DEMO_VIEWER_PASSWORD: VIEWER.password,
});

describe('demo accounts', () => {
  const db = useTestDb();
  let app: App;
  let techstoreId: string;

  beforeAll(async () => {
    app = await createTestApp({ AUTH_RATE_LIMIT_MAX: '1000' });
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    techstoreId = (await seedDatabase(db, config)).businessId;
  });

  async function login({ email, password }: { email: string; password: string }) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    expect(res.statusCode).toBe(200);
    const cookie = res.cookies.find((c) => c.name === REFRESH_COOKIE);
    return { ...authResponseSchema.parse(res.json()), refreshCookie: cookie?.value };
  }

  const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

  const getBusiness = (token: string, businessId: string) =>
    app.inject({ method: 'GET', url: `/api/v1/businesses/${businessId}`, headers: bearer(token) });

  const me = (token: string) =>
    app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: bearer(token) });

  const techstoreSummary = () => ({
    id: techstoreId,
    slug: TECHSTORE.slug,
    name: TECHSTORE.name,
    currency: TECHSTORE.currency,
    timezone: TECHSTORE.timezone,
  });

  describe('OWNER', () => {
    it('signs in as the owner of TechStore, with onboarding already complete', async () => {
      const owner = await login(OWNER);

      expect(owner.memberships).toEqual([{ role: 'OWNER', business: techstoreSummary() }]);
      expect(owner.onboarding).toEqual({ status: 'COMPLETED', currentStep: 'REVIEW' });
    });

    it('opens TechStore with its settings', async () => {
      const { accessToken } = await login(OWNER);
      const res = await getBusiness(accessToken, techstoreId);

      expect(res.statusCode).toBe(200);
      const { slug: _slug, ...settings } = TECHSTORE;
      expect(businessResponseSchema.parse(res.json())).toEqual({
        role: 'OWNER',
        business: { ...techstoreSummary(), ...settings },
      });
    });

    it('cannot onboard a second time', async () => {
      const { accessToken } = await login(OWNER);
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/onboarding/complete',
        headers: bearer(accessToken),
      });

      expect(res.statusCode).toBe(409);
      expect(apiErrorSchema.parse(res.json()).error.code).toBe('ONBOARDING_ALREADY_COMPLETED');
    });
  });

  describe('VIEWER', () => {
    it('signs in as a viewer of TechStore, without needing to onboard', async () => {
      const viewer = await login(VIEWER);

      expect(viewer.memberships).toEqual([{ role: 'VIEWER', business: techstoreSummary() }]);
      // NOT_STARTED, yet the app opens: access comes from the membership.
      expect(viewer.onboarding.status).toBe('NOT_STARTED');
    });

    it('opens TechStore read-only', async () => {
      const { accessToken } = await login(VIEWER);
      const res = await getBusiness(accessToken, techstoreId);

      expect(res.statusCode).toBe(200);
      expect(businessResponseSchema.parse(res.json())).toMatchObject({
        role: 'VIEWER',
        business: techstoreSummary(),
      });
    });

    it('cannot change TechStore by calling the API directly', async () => {
      const { accessToken } = await login(VIEWER);
      const before = await db.business.findUniqueOrThrow({ where: { id: techstoreId } });
      const membershipsBefore = await db.membership.findMany({
        where: { businessId: techstoreId },
        orderBy: { createdAt: 'asc' },
      });

      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
        for (const url of [`/api/v1/businesses/${techstoreId}`, '/api/v1/businesses']) {
          const res = await app.inject({
            method,
            url,
            headers: bearer(accessToken),
            payload: { name: 'Hacked', role: 'OWNER' },
          });
          expect(res.statusCode, `${method} ${url}`).toBe(404);
        }
      }

      // Onboarding acts only on the caller: it gives the viewer a business of
      // their own (by design), never TechStore or a better role in it.
      const draft = {
        businessDetails: { name: 'TechStore', currency: 'EUR', timezone: 'Europe/Sofia' },
      };
      await app.inject({
        method: 'PUT',
        url: '/api/v1/onboarding',
        headers: bearer(accessToken),
        payload: { currentStep: 'REVIEW', draft },
      });
      const completed = await app.inject({
        method: 'POST',
        url: '/api/v1/onboarding/complete',
        headers: bearer(accessToken),
      });
      const own = completeOnboardingResponseSchema.parse(completed.json()).membership.business;
      expect(own.id).not.toBe(techstoreId);

      expect(await db.business.findUniqueOrThrow({ where: { id: techstoreId } })).toEqual(before);
      expect(
        await db.membership.findMany({
          where: { businessId: techstoreId },
          orderBy: { createdAt: 'asc' },
        }),
      ).toEqual(membershipsBefore);
      expect(
        currentUserResponseSchema.parse((await me(accessToken)).json()).memberships[0],
      ).toEqual({ role: 'VIEWER', business: techstoreSummary() });
    });
  });

  describe('both accounts', () => {
    it.each([
      ['OWNER', OWNER],
      ['VIEWER', VIEWER],
    ])('%s cannot open a business they are not a member of', async (_role, account) => {
      const other = await db.business.create({ data: fixtures.business({ name: 'Other' }) });
      const { accessToken } = await login(account);

      const res = await getBusiness(accessToken, other.id);
      expect(res.statusCode).toBe(404);
      expect(apiErrorSchema.parse(res.json()).error).toMatchObject({
        code: 'NOT_FOUND',
        message: 'Business not found.',
      });
    });

    it.each([
      ['OWNER', OWNER, 'OWNER'],
      ['VIEWER', VIEWER, 'VIEWER'],
    ])(
      '%s keeps their role across refresh, and loses access on logout',
      async (_label, account, role) => {
        const session = await login(account);
        const cookie = { [REFRESH_COOKIE]: session.refreshCookie! };
        const origin = { origin: 'http://localhost:5173' };

        const refreshed = await app.inject({
          method: 'POST',
          url: '/api/v1/auth/refresh',
          cookies: cookie,
          headers: origin,
        });
        expect(refreshed.statusCode).toBe(200);
        const next = authResponseSchema.parse(refreshed.json());
        expect(next.memberships[0]?.role).toBe(role);
        expect((await getBusiness(next.accessToken, techstoreId)).json()).toMatchObject({ role });

        const rotated = refreshed.cookies.find((c) => c.name === REFRESH_COOKIE)!.value;
        const logout = await app.inject({
          method: 'POST',
          url: '/api/v1/auth/logout',
          cookies: { [REFRESH_COOKIE]: rotated },
          headers: { ...origin, ...bearer(next.accessToken) },
        });
        expect(logout.statusCode).toBe(204);
        expect((await getBusiness(next.accessToken, techstoreId)).statusCode).toBe(401);
      },
    );
  });
});

describe('write surface of the API', () => {
  let app: App;
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  /*
   * Every route that changes data. None takes a business id: they act only on
   * the caller's own account and onboarding, so no role can change an
   * existing business. A new write route must check the caller's role (OWNER
   * for business changes) and be added here with tests for both roles.
   */
  it('has only account and onboarding writes, none on an existing business', () => {
    const paths = (app.swagger() as { paths: Record<string, Record<string, unknown>> }).paths;
    const writes = Object.entries(paths).flatMap(([path, methods]) =>
      Object.keys(methods)
        .map((method) => method.toUpperCase())
        .filter((method) => !['GET', 'HEAD', 'OPTIONS'].includes(method))
        .map((method) => `${method} ${path.replace(/\/$/, '')}`),
    );

    expect(writes.sort()).toEqual([
      'POST /api/v1/auth/login',
      'POST /api/v1/auth/logout',
      'POST /api/v1/auth/refresh',
      'POST /api/v1/auth/register',
      'POST /api/v1/onboarding/complete',
      'PUT /api/v1/onboarding',
    ]);
  });
});
