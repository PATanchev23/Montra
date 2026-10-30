import {
  apiErrorSchema,
  authResponseSchema,
  businessResponseSchema,
  completeOnboardingResponseSchema,
  currentUserResponseSchema,
  onboardingProgressSchema,
} from '@montra/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedDatabase, TECHSTORE } from '../prisma/seed/techstore';
import type { App } from '../src/app';
import type { Db } from '../src/db';
import { completeOnboarding } from '../src/modules/onboarding/service';
import { fixtures, useTestDb } from './db';
import { createTestApp } from './helpers';

const ONBOARDING = '/api/v1/onboarding';
const PASSWORD = 'correct horse battery';

type Response = Awaited<ReturnType<App['inject']>>;

const errorOf = (res: Response) => apiErrorSchema.parse(res.json()).error;

const businessDetails = {
  name: '  TechStore ',
  industry: ' Consumer electronics ',
  currency: 'EUR',
  timezone: 'europe/sofia',
};

describe('onboarding API', () => {
  const db = useTestDb();
  let app: App;

  beforeAll(async () => {
    app = await createTestApp({ AUTH_RATE_LIMIT_MAX: '1000' });
  });
  afterAll(() => app.close());

  let emailCounter = 0;

  /** Registers a fresh user and returns their id and access token. */
  async function signUp(name = 'Ana Petrova') {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { name, email: `owner${++emailCounter}@example.com`, password: PASSWORD },
    });
    expect(res.statusCode).toBe(201);
    const body = authResponseSchema.parse(res.json());
    return { userId: body.user.id, token: body.accessToken };
  }

  const auth = (token?: string) =>
    token === undefined ? {} : { headers: { authorization: `Bearer ${token}` } };

  const getProgress = (token?: string) =>
    app.inject({ method: 'GET', url: ONBOARDING, ...auth(token) });

  const save = (token: string | undefined, payload: unknown) =>
    app.inject({ method: 'PUT', url: ONBOARDING, payload: payload as object, ...auth(token) });

  const complete = (token?: string) =>
    app.inject({ method: 'POST', url: `${ONBOARDING}/complete`, ...auth(token) });

  const me = async (token: string) =>
    currentUserResponseSchema.parse(
      (await app.inject({ method: 'GET', url: '/api/v1/auth/me', ...auth(token) })).json(),
    );

  const getBusiness = (token: string | undefined, businessId: string) =>
    app.inject({ method: 'GET', url: `/api/v1/businesses/${businessId}`, ...auth(token) });

  /** A user whose draft is ready to complete. */
  async function readyToComplete(name?: string, details: object = businessDetails) {
    const user = await signUp();
    const res = await save(user.token, {
      currentStep: 'REVIEW',
      draft: {
        businessDetails: { ...details, ...(name && { name }) },
        financialPreferences: { fiscalYearStartMonth: 4, lowBalanceThresholdCents: 250_000 },
      },
    });
    expect(res.statusCode).toBe(200);
    return user;
  }

  describe('progress', () => {
    it('starts as not started, with an empty draft', async () => {
      const { token } = await signUp();
      const res = await getProgress(token);

      expect(res.statusCode).toBe(200);
      expect(onboardingProgressSchema.parse(res.json())).toEqual({
        status: 'NOT_STARTED',
        currentStep: 'BUSINESS_DETAILS',
        draft: {},
        completedAt: null,
        businessId: null,
      });
    });

    it('persists answers in normalised form and resumes from them', async () => {
      const { userId, token } = await signUp();
      const res = await save(token, {
        currentStep: 'FINANCIAL_PREFERENCES',
        draft: { businessDetails: businessDetails, injected: { admin: true } },
      });

      const expected = {
        status: 'IN_PROGRESS',
        currentStep: 'FINANCIAL_PREFERENCES',
        draft: {
          businessDetails: {
            name: 'TechStore',
            industry: 'Consumer electronics',
            currency: 'EUR',
            timezone: 'Europe/Sofia',
          },
        },
        completedAt: null,
        businessId: null,
      };
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual(expected);

      // A later visit (a new request, as after signing in again) resumes the same state.
      expect((await getProgress(token)).json()).toEqual(expected);
      const row = await db.onboardingProgress.findUniqueOrThrow({ where: { userId } });
      expect(row.currentStep).toBe('FINANCIAL_PREFERENCES');
      expect(row.draft).toEqual(expected.draft);
      expect(await me(token)).toMatchObject({
        onboarding: { status: 'IN_PROGRESS', currentStep: 'FINANCIAL_PREFERENCES' },
        memberships: [],
      });
    });

    it('replaces the draft on every save', async () => {
      const { token } = await signUp();
      await save(token, {
        currentStep: 'FINANCIAL_PREFERENCES',
        draft: { businessDetails, financialPreferences: { fiscalYearStartMonth: 7 } },
      });
      const res = await save(token, {
        currentStep: 'BUSINESS_DETAILS',
        draft: { businessDetails: { name: 'Renamed' } },
      });

      expect(res.json()).toMatchObject({
        currentStep: 'BUSINESS_DETAILS',
        draft: { businessDetails: { name: 'Renamed' } },
      });
      expect(res.json().draft.financialPreferences).toBeUndefined();
    });

    it.each([
      ['an unknown step', { currentStep: 'DONE', draft: {} }],
      ['a missing draft', { currentStep: 'BUSINESS_DETAILS' }],
      [
        'an unsupported currency',
        { currentStep: 'BUSINESS_DETAILS', draft: { businessDetails: { currency: 'BTC' } } },
      ],
      [
        'an unknown time zone',
        { currentStep: 'BUSINESS_DETAILS', draft: { businessDetails: { timezone: 'Mars/Base' } } },
      ],
      [
        'a blank business name',
        { currentStep: 'BUSINESS_DETAILS', draft: { businessDetails: { name: '   ' } } },
      ],
      [
        'a fiscal month of 13',
        {
          currentStep: 'FINANCIAL_PREFERENCES',
          draft: { financialPreferences: { fiscalYearStartMonth: 13 } },
        },
      ],
      [
        'a negative threshold',
        {
          currentStep: 'FINANCIAL_PREFERENCES',
          draft: { financialPreferences: { lowBalanceThresholdCents: -1 } },
        },
      ],
      [
        'fractional cents',
        {
          currentStep: 'FINANCIAL_PREFERENCES',
          draft: { financialPreferences: { lowBalanceThresholdCents: 10.5 } },
        },
      ],
      ['a non-object body', []],
    ])('rejects %s and keeps the previous draft', async (_label, payload) => {
      const { userId, token } = await signUp();
      await save(token, {
        currentStep: 'BUSINESS_DETAILS',
        draft: { businessDetails: { name: 'Shop' } },
      });

      const res = await save(token, payload);

      expect(res.statusCode).toBe(400);
      expect(errorOf(res).code).toBe('VALIDATION_ERROR');
      const row = await db.onboardingProgress.findUniqueOrThrow({ where: { userId } });
      expect(row.draft).toEqual({ businessDetails: { name: 'Shop' } });
    });
  });

  describe('completion', () => {
    it('creates the business, makes the user its OWNER, and marks onboarding complete', async () => {
      const { userId, token } = await readyToComplete();
      const res = await complete(token);

      expect(res.statusCode).toBe(201);
      const body = completeOnboardingResponseSchema.parse(res.json());
      const business = await db.business.findUniqueOrThrow({
        where: { id: body.membership.business.id },
      });
      expect(business).toMatchObject({
        slug: 'techstore',
        name: 'TechStore',
        industry: 'Consumer electronics',
        currency: 'EUR',
        timezone: 'Europe/Sofia',
        fiscalYearStartMonth: 4,
        lowBalanceThresholdCents: 250_000,
      });
      expect(body.membership).toEqual({
        role: 'OWNER',
        business: {
          id: business.id,
          slug: 'techstore',
          name: 'TechStore',
          currency: 'EUR',
          timezone: 'Europe/Sofia',
        },
      });
      expect(body.onboarding).toMatchObject({
        status: 'COMPLETED',
        currentStep: 'REVIEW',
        businessId: business.id,
      });

      // Database consistency: one membership, and the onboarding row points at the business.
      expect(await db.membership.findMany({ where: { userId } })).toEqual([
        expect.objectContaining({ businessId: business.id, role: 'OWNER' }),
      ]);
      const row = await db.onboardingProgress.findUniqueOrThrow({ where: { userId } });
      expect(row.businessId).toBe(business.id);
      expect(row.completedAt).toBeInstanceOf(Date);
      expect(body.onboarding.completedAt).toBe(row.completedAt!.toISOString());

      // /auth/me now reflects the business, so the app opens the dashboard.
      expect(await me(token)).toMatchObject({
        onboarding: { status: 'COMPLETED', currentStep: 'REVIEW' },
        memberships: [body.membership],
      });
    });

    it('uses business defaults for preferences that were not given', async () => {
      const { token } = await signUp();
      await save(token, {
        currentStep: 'REVIEW',
        draft: { businessDetails: { ...businessDetails, industry: '' } },
      });

      const body = completeOnboardingResponseSchema.parse((await complete(token)).json());

      const business = await db.business.findUniqueOrThrow({
        where: { id: body.membership.business.id },
      });
      expect(business).toMatchObject({
        industry: null,
        fiscalYearStartMonth: 1,
        lowBalanceThresholdCents: null,
      });
    });

    it('lists what is missing when the draft is incomplete, and creates nothing', async () => {
      const { token } = await signUp();
      await save(token, {
        currentStep: 'REVIEW',
        draft: { businessDetails: { name: 'Shop' } },
      });

      const res = await complete(token);

      expect(res.statusCode).toBe(422);
      const error = errorOf(res);
      expect(error.code).toBe('ONBOARDING_INCOMPLETE');
      expect(error.details).toEqual([
        { path: 'businessDetails.currency', message: expect.any(String) },
        { path: 'businessDetails.timezone', message: expect.any(String) },
      ]);
      expect(await db.business.count()).toBe(0);
      expect(await db.membership.count()).toBe(0);
    });

    it('refuses to complete before anything is saved', async () => {
      const { token } = await signUp();
      const res = await complete(token);

      expect(res.statusCode).toBe(422);
      expect(errorOf(res).details).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: 'businessDetails' })]),
      );
    });

    it('refuses a second completion and further edits, without a second business', async () => {
      const { token } = await readyToComplete();
      expect((await complete(token)).statusCode).toBe(201);

      const again = await complete(token);
      expect(again.statusCode).toBe(409);
      expect(errorOf(again).code).toBe('ONBOARDING_ALREADY_COMPLETED');

      const edit = await save(token, { currentStep: 'BUSINESS_DETAILS', draft: {} });
      expect(edit.statusCode).toBe(409);
      expect(errorOf(edit).code).toBe('ONBOARDING_ALREADY_COMPLETED');

      expect(await db.business.count()).toBe(1);
      expect((await getProgress(token)).json()).toMatchObject({ status: 'COMPLETED' });
    });

    it('creates exactly one business when the same submission arrives many times at once', async () => {
      const { userId, token } = await readyToComplete();

      const responses = await Promise.all(Array.from({ length: 6 }, () => complete(token)));

      const statuses = responses.map((res) => res.statusCode).sort();
      expect(statuses).toEqual([201, 409, 409, 409, 409, 409]);
      for (const res of responses.filter((r) => r.statusCode === 409)) {
        expect(errorOf(res).code).toBe('ONBOARDING_ALREADY_COMPLETED');
      }
      expect(await db.business.count()).toBe(1);
      expect(await db.membership.count({ where: { userId } })).toBe(1);
    });

    it('rolls back the business and membership if the draft changes while completing', async () => {
      const { userId, token } = await readyToComplete();
      // Simulates a save landing between validation and the final update.
      const racingDb = new Proxy(db, {
        get(target, property, receiver) {
          if (property !== '$transaction') return Reflect.get(target, property, receiver);
          return async (callback: Parameters<Db['$transaction']>[0]) => {
            await target.onboardingProgress.update({
              where: { userId },
              data: { currentStep: 'FINANCIAL_PREFERENCES' },
            });
            return target.$transaction(callback);
          };
        },
      });

      await expect(completeOnboarding(racingDb, userId)).rejects.toMatchObject({
        statusCode: 409,
        code: 'ONBOARDING_CHANGED',
      });
      expect(await db.business.count()).toBe(0);
      expect(await db.membership.count()).toBe(0);
      expect(await db.onboardingProgress.findUniqueOrThrow({ where: { userId } })).toMatchObject({
        completedAt: null,
        businessId: null,
      });

      // The user simply tries again.
      expect((await complete(token)).statusCode).toBe(201);
    });

    it('gives each business a unique slug, readable even for Cyrillic names', async () => {
      const first = await readyToComplete('TechStore');
      const second = await readyToComplete('TechStore');
      const cyrillic = await readyToComplete('Техностор ЕООД');

      const slugOf = async (token: string) =>
        completeOnboardingResponseSchema.parse((await complete(token)).json()).membership.business
          .slug;

      expect(await slugOf(first.token)).toBe('techstore');
      expect(await slugOf(second.token)).toMatch(/^techstore-[a-z0-9]{4}$/);
      expect(await slugOf(cyrillic.token)).toBe('tehnostor-eood');
    });

    it('completes for a user without an onboarding row once they save a draft', async () => {
      const { userId, token } = await signUp();
      await db.onboardingProgress.delete({ where: { userId } });

      expect((await getProgress(token)).json()).toMatchObject({ status: 'NOT_STARTED' });
      expect(
        (await save(token, { currentStep: 'REVIEW', draft: { businessDetails } })).statusCode,
      ).toBe(200);
      expect((await complete(token)).statusCode).toBe(201);
    });
  });

  describe('access control', () => {
    it.each([
      ['GET /onboarding', () => getProgress()],
      ['PUT /onboarding', () => save(undefined, { currentStep: 'BUSINESS_DETAILS', draft: {} })],
      ['PUT /onboarding with an invalid body', () => save(undefined, { nonsense: true })],
      ['POST /onboarding/complete', () => complete()],
      ['GET /businesses/:id', () => getBusiness(undefined, 'any')],
    ])('refuses %s without a valid access token', async (_label, request) => {
      const res = await request();
      expect(res.statusCode).toBe(401);
      expect(errorOf(res).code).toBe('INVALID_ACCESS_TOKEN');
    });

    it('refuses a token whose session has ended', async () => {
      const { userId, token } = await signUp();
      await db.session.updateMany({ where: { userId }, data: { revokedAt: new Date() } });

      expect((await getProgress(token)).statusCode).toBe(401);
      expect((await complete(token)).statusCode).toBe(401);
    });

    it('keeps each user’s onboarding separate', async () => {
      const ana = await readyToComplete('Ana’s Shop');
      const ivan = await signUp('Ivan');

      expect((await getProgress(ivan.token)).json()).toMatchObject({
        status: 'NOT_STARTED',
        draft: {},
      });
      expect((await complete(ivan.token)).statusCode).toBe(422);
      expect((await getProgress(ana.token)).json()).toMatchObject({ status: 'IN_PROGRESS' });
    });

    it('shows a business only to its members', async () => {
      const owner = await readyToComplete();
      const { membership } = completeOnboardingResponseSchema.parse(
        (await complete(owner.token)).json(),
      );
      const outsider = await readyToComplete('Other Shop');
      const other = completeOnboardingResponseSchema.parse((await complete(outsider.token)).json());

      const own = await getBusiness(owner.token, membership.business.id);
      expect(own.statusCode).toBe(200);
      expect(businessResponseSchema.parse(own.json())).toEqual({
        role: 'OWNER',
        business: {
          ...membership.business,
          industry: 'Consumer electronics',
          fiscalYearStartMonth: 4,
          lowBalanceThresholdCents: 250_000,
        },
      });

      // Another tenant's business and a made-up id look exactly the same.
      for (const id of [other.membership.business.id, 'does-not-exist']) {
        const res = await getBusiness(owner.token, id);
        expect(res.statusCode).toBe(404);
        expect(errorOf(res)).toMatchObject({ code: 'NOT_FOUND', message: 'Business not found.' });
      }
    });
  });

  describe('viewers', () => {
    async function viewerOf(businessId: string) {
      const viewer = await signUp('Judge');
      await db.onboardingProgress.delete({ where: { userId: viewer.userId } });
      await db.membership.create({
        data: { userId: viewer.userId, businessId, role: 'VIEWER' },
      });
      return viewer;
    }

    it('open the business they were added to without onboarding', async () => {
      const business = await db.business.create({ data: fixtures.business({ name: 'Shop' }) });
      const viewer = await viewerOf(business.id);

      expect(await me(viewer.token)).toMatchObject({
        onboarding: { status: 'NOT_STARTED' },
        memberships: [{ role: 'VIEWER', business: { id: business.id } }],
      });
      expect((await getBusiness(viewer.token, business.id)).json()).toMatchObject({
        role: 'VIEWER',
      });
    });

    it('can still set up a business of their own, keeping their viewer access', async () => {
      const business = await db.business.create({ data: fixtures.business({ name: 'Shop' }) });
      const viewer = await viewerOf(business.id);

      await save(viewer.token, { currentStep: 'REVIEW', draft: { businessDetails } });
      const own = completeOnboardingResponseSchema.parse((await complete(viewer.token)).json());

      const { memberships } = await me(viewer.token);
      expect(memberships.map((m) => [m.role, m.business.id])).toEqual([
        ['VIEWER', business.id],
        ['OWNER', own.membership.business.id],
      ]);
    });
  });

  describe('TechStore demo data', () => {
    it('is untouched by onboarding, and its demo owner cannot onboard again', async () => {
      const summary = await seedDatabase(db, {
        owner: { email: 'demo@techstore.example', password: PASSWORD, name: 'Presiyan' },
        viewer: { email: 'judge@techstore.example', password: PASSWORD, name: 'Judge' },
      });
      const login = async (email: string) =>
        authResponseSchema.parse(
          (
            await app.inject({
              method: 'POST',
              url: '/api/v1/auth/login',
              payload: { email, password: PASSWORD },
            })
          ).json(),
        ).accessToken;
      const ownerToken = await login('demo@techstore.example');
      const viewerToken = await login('judge@techstore.example');
      const before = await db.business.findUniqueOrThrow({ where: { slug: TECHSTORE.slug } });

      // A new user taking the same name gets their own business, not TechStore.
      const newcomer = await readyToComplete('TechStore');
      const created = completeOnboardingResponseSchema.parse(
        (await complete(newcomer.token)).json(),
      );
      expect(created.membership.business.slug).toMatch(/^techstore-/);

      expect((await getProgress(ownerToken)).json()).toMatchObject({
        status: 'COMPLETED',
        businessId: summary.businessId,
      });
      expect((await complete(ownerToken)).statusCode).toBe(409);
      expect((await getBusiness(viewerToken, summary.businessId)).json()).toMatchObject({
        role: 'VIEWER',
      });
      expect((await getBusiness(viewerToken, created.membership.business.id)).statusCode).toBe(404);
      expect(await db.business.findUniqueOrThrow({ where: { slug: TECHSTORE.slug } })).toEqual(
        before,
      );
      expect(await db.membership.count({ where: { businessId: summary.businessId } })).toBe(2);
    });
  });
});
