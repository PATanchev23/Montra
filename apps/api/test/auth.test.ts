import {
  apiErrorSchema,
  authResponseSchema,
  currentUserResponseSchema,
  type AuthResponse,
} from '@montra/shared';
import { createHash, createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../src/app';
import { hashPassword } from '../src/lib/credentials';
import { fixtures, useTestDb } from './db';
import { createTestApp } from './helpers';

const AUTH = '/api/v1/auth';
const COOKIE = 'montra_refresh';
const SECRET = 'integration-test-secret-0123456789-abcdefghij';
const PASSWORD = 'correct horse battery';
const DAY_MS = 86_400_000;

type Response = Awaited<ReturnType<App['inject']>>;

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** Signs a JWT by hand, so tests can forge the tokens an attacker could. */
function signJwt(claims: Record<string, unknown>, { secret = SECRET, alg = 'HS256' } = {}) {
  const encode = (part: object) => Buffer.from(JSON.stringify(part)).toString('base64url');
  const unsigned = `${encode({ alg, typ: 'JWT' })}.${encode(claims)}`;
  const signature =
    alg === 'none' ? '' : createHmac('sha256', secret).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
}

function refreshCookieOf(res: Response) {
  return res.cookies.find((cookie) => cookie.name === COOKIE);
}

function errorCodeOf(res: Response) {
  return apiErrorSchema.parse(res.json()).error.code;
}

describe('auth API', () => {
  const db = useTestDb();
  let app: App;

  beforeAll(async () => {
    app = await createTestApp({
      JWT_SECRET: SECRET,
      AUTH_RATE_LIMIT_MAX: '1000',
      REFRESH_RATE_LIMIT_MAX: '1000',
    });
  });
  afterAll(() => app.close());

  const register = (payload: Record<string, unknown> = {}) =>
    app.inject({
      method: 'POST',
      url: `${AUTH}/register`,
      payload: { name: 'Ana Petrova', email: 'ana@example.com', password: PASSWORD, ...payload },
    });

  const login = (email: string, password: string) =>
    app.inject({ method: 'POST', url: `${AUTH}/login`, payload: { email, password } });

  const refresh = (token: string | undefined, headers: Record<string, string> = {}) =>
    app.inject({
      method: 'POST',
      url: `${AUTH}/refresh`,
      headers,
      ...(token !== undefined && { cookies: { [COOKIE]: token } }),
    });

  const logout = (token?: string) =>
    app.inject({
      method: 'POST',
      url: `${AUTH}/logout`,
      ...(token !== undefined && { cookies: { [COOKIE]: token } }),
    });

  const me = (accessToken?: string) =>
    app.inject({
      method: 'GET',
      url: `${AUTH}/me`,
      ...(accessToken !== undefined && { headers: { authorization: `Bearer ${accessToken}` } }),
    });

  /** Registers a user and returns their tokens. */
  async function signUp(payload: Record<string, unknown> = {}) {
    const res = await register(payload);
    expect(res.statusCode).toBe(201);
    const body = authResponseSchema.parse(res.json());
    return { body, refreshToken: refreshCookieOf(res)!.value };
  }

  describe('POST /auth/register', () => {
    it('creates only the user and their resumable onboarding, and signs them in', async () => {
      const res = await register({ name: '  Ana Petrova ', email: '  Ana@Example.COM ' });

      expect(res.statusCode).toBe(201);
      expect(res.headers['cache-control']).toBe('no-store');
      const body = authResponseSchema.parse(res.json());
      expect(body.user).toEqual({
        id: expect.any(String),
        email: 'ana@example.com',
        name: 'Ana Petrova',
      });
      expect(body.memberships).toEqual([]);
      expect(body.onboarding).toEqual({ status: 'NOT_STARTED', currentStep: 'BUSINESS_DETAILS' });

      const user = await db.user.findUniqueOrThrow({
        where: { email: 'ana@example.com' },
        include: { onboarding: true, memberships: true, sessions: true },
      });
      expect(user.passwordHash).toMatch(/^\$argon2id\$/);
      expect(user.onboarding).toMatchObject({
        currentStep: 'BUSINESS_DETAILS',
        draft: {},
        completedAt: null,
        businessId: null,
      });
      expect(user.memberships).toEqual([]);
      expect(await db.business.count()).toBe(0);
      expect(user.sessions).toHaveLength(1);
    });

    it('sets the refresh token as an HttpOnly, SameSite=Strict cookie and stores only its hash', async () => {
      const res = await register();
      const cookie = refreshCookieOf(res)!;

      expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/api/v1/auth' });
      expect(cookie.secure).toBeFalsy(); // Secure is production-only; see the production test.
      expect(cookie.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const expires = new Date(cookie.expires!).getTime();
      expect(expires).toBeGreaterThan(Date.now() + 29 * DAY_MS);
      expect(expires).toBeLessThanOrEqual(Date.now() + 30 * DAY_MS);

      const session = await db.session.findFirstOrThrow();
      expect(session.tokenHash).toBe(sha256(cookie.value));
      expect(session.tokenHash).not.toContain(cookie.value);
    });

    it('issues a short-lived HS256 access token that carries only ids', async () => {
      const { body } = await signUp();
      const [header, payload] = body.accessToken
        .split('.')
        .slice(0, 2)
        .map((part) => JSON.parse(Buffer.from(part, 'base64url').toString()));

      expect(header).toEqual({ alg: 'HS256', typ: 'JWT' });
      const session = await db.session.findFirstOrThrow();
      expect(payload).toEqual({
        sub: body.user.id,
        sid: session.id,
        iss: 'montra-api',
        aud: 'montra-web',
        iat: expect.any(Number),
        exp: payload.iat + 15 * 60,
      });
      expect(body.accessTokenExpiresAt).toBe(new Date(payload.exp * 1000).toISOString());
    });

    it('never puts secrets in the response body', async () => {
      const res = await register();
      expect(res.body).not.toContain(refreshCookieOf(res)!.value);
      expect(res.body).not.toMatch(/argon2|passwordHash|refreshToken|correct horse/i);
    });

    it('rejects invalid input with a validation error and creates nothing', async () => {
      const res = await register({ name: ' ', email: 'not-an-email', password: 'short' });

      expect(res.statusCode).toBe(400);
      const body = apiErrorSchema.parse(res.json());
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect((body.error.details as { path: string }[]).map((d) => d.path).sort()).toEqual([
        'email',
        'name',
        'password',
      ]);
      expect(refreshCookieOf(res)).toBeUndefined();
      expect(await db.user.count()).toBe(0);
    });

    it('rejects a duplicate email regardless of case or spacing', async () => {
      await signUp({ email: 'ana@example.com' });
      const res = await register({ email: ' ANA@example.com' });

      expect(res.statusCode).toBe(409);
      expect(errorCodeOf(res)).toBe('EMAIL_TAKEN');
      expect(refreshCookieOf(res)).toBeUndefined();
      expect(await db.user.count()).toBe(1);
    });
  });

  describe('POST /auth/login', () => {
    it('signs in with the right password, whatever the email casing', async () => {
      const { body: registered } = await signUp();
      const res = await login(' ANA@Example.com ', PASSWORD);

      expect(res.statusCode).toBe(200);
      const body = authResponseSchema.parse(res.json());
      expect(body.user.id).toBe(registered.user.id);
      expect(refreshCookieOf(res)?.value).toBeTruthy();
      expect(await db.session.count({ where: { revokedAt: null } })).toBe(2);
    });

    it('gives the same answer for a wrong password and an unknown email', async () => {
      await signUp();
      const wrongPassword = await login('ana@example.com', 'wrong horse battery');
      const unknownEmail = await login('nobody@example.com', PASSWORD);

      for (const res of [wrongPassword, unknownEmail]) {
        expect(res.statusCode).toBe(401);
        expect(refreshCookieOf(res)).toBeUndefined();
      }
      const strip = (res: Response) => ({
        ...apiErrorSchema.parse(res.json()).error,
        requestId: undefined,
      });
      expect(strip(wrongPassword)).toEqual({
        code: 'INVALID_CREDENTIALS',
        message: 'Incorrect email or password.',
        requestId: undefined,
      });
      expect(strip(unknownEmail)).toEqual(strip(wrongPassword));
      expect(await db.session.count()).toBe(1); // only the one from registration
    });

    it('rejects a malformed request', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `${AUTH}/login`,
        payload: { email: 'x' },
      });
      expect(res.statusCode).toBe(400);
      expect(errorCodeOf(res)).toBe('VALIDATION_ERROR');
    });

    it('prunes the user’s expired sessions', async () => {
      const { body } = await signUp();
      await db.session.updateMany({
        data: {
          createdAt: new Date(Date.now() - 40 * DAY_MS),
          expiresAt: new Date(Date.now() - DAY_MS),
        },
      });

      await login('ana@example.com', PASSWORD);

      const sessions = await db.session.findMany({ where: { userId: body.user.id } });
      expect(sessions).toHaveLength(1);
      expect(sessions[0]!.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('GET /auth/me', () => {
    it('returns the profile, memberships and onboarding status for a valid token', async () => {
      const { body: registered } = await signUp();
      const res = await me(registered.accessToken);

      expect(res.statusCode).toBe(200);
      expect(currentUserResponseSchema.parse(res.json())).toEqual({
        user: registered.user,
        memberships: [],
        onboarding: { status: 'NOT_STARTED', currentStep: 'BUSINESS_DETAILS' },
      });
    });

    it('reports onboarding that has been started but not finished', async () => {
      const { body } = await signUp();
      await db.onboardingProgress.update({
        where: { userId: body.user.id },
        data: {
          currentStep: 'FINANCIAL_PREFERENCES',
          draft: { businessDetails: { name: 'Shop' } },
        },
      });

      const res = await me(body.accessToken);
      expect(res.json().onboarding).toEqual({
        status: 'IN_PROGRESS',
        currentStep: 'FINANCIAL_PREFERENCES',
      });
    });

    it('lists the businesses an onboarded owner and a viewer can open', async () => {
      const business = await db.business.create({ data: fixtures.business({ name: 'Shop' }) });
      const passwordHash = await hashPassword(PASSWORD);
      await db.user.create({
        data: {
          ...fixtures.user({ email: 'owner@example.com' }),
          passwordHash,
          memberships: { create: { businessId: business.id, role: 'OWNER' } },
          onboarding: {
            create: { currentStep: 'REVIEW', completedAt: new Date(), businessId: business.id },
          },
        },
      });
      await db.user.create({
        data: {
          ...fixtures.user({ email: 'viewer@example.com' }),
          passwordHash,
          memberships: { create: { businessId: business.id, role: 'VIEWER' } },
        },
      });
      const summary = {
        id: business.id,
        slug: business.slug,
        name: 'Shop',
        currency: 'EUR',
        timezone: 'Europe/Sofia',
      };

      const owner = authResponseSchema.parse((await login('owner@example.com', PASSWORD)).json());
      expect(owner.memberships).toEqual([{ role: 'OWNER', business: summary }]);
      expect(owner.onboarding).toEqual({ status: 'COMPLETED', currentStep: 'REVIEW' });

      const viewer = authResponseSchema.parse((await login('viewer@example.com', PASSWORD)).json());
      expect(viewer.memberships).toEqual([{ role: 'VIEWER', business: summary }]);
      expect(viewer.onboarding.status).toBe('NOT_STARTED');
    });

    it('rejects a missing token', async () => {
      const res = await me();
      expect(res.statusCode).toBe(401);
      expect(errorCodeOf(res)).toBe('INVALID_ACCESS_TOKEN');
      expect(res.headers['www-authenticate']).toBe('Bearer');
    });

    it('accepts a correctly signed token, so the forgeries below fail for the reason given', async () => {
      const { body } = await signUp();
      const session = await db.session.findFirstOrThrow();
      const now = Math.floor(Date.now() / 1000);
      const token = signJwt({
        sub: body.user.id,
        sid: session.id,
        iss: 'montra-api',
        aud: 'montra-web',
        iat: now,
        exp: now + 60,
      });
      expect((await me(token)).statusCode).toBe(200);
    });

    it.each([
      ['garbage', () => 'not-a-jwt'],
      ['a different signing secret', (c: Claims) => signJwt(c, { secret: `${SECRET}-other` })],
      ['alg "none"', (c: Claims) => signJwt(c, { alg: 'none' })],
      ['an expired token', (c: Claims) => signJwt({ ...c, iat: c.iat - 3600, exp: c.iat - 60 })],
      ['a foreign audience', (c: Claims) => signJwt({ ...c, aud: 'someone-else' })],
      ['another user’s session id', (c: Claims) => signJwt({ ...c, sub: 'someone-else' })],
      ['an unknown session', (c: Claims) => signJwt({ ...c, sid: 'no-such-session' })],
    ])('rejects %s', async (_label, forge) => {
      const { body } = await signUp();
      const session = await db.session.findFirstOrThrow();
      const now = Math.floor(Date.now() / 1000);
      const claims = {
        sub: body.user.id,
        sid: session.id,
        iss: 'montra-api',
        aud: 'montra-web',
        iat: now,
        exp: now + 60,
      };

      const res = await me(forge(claims));
      expect(res.statusCode).toBe(401);
      expect(errorCodeOf(res)).toBe('INVALID_ACCESS_TOKEN');
    });

    it('rejects a token whose session has expired', async () => {
      const { body } = await signUp();
      await db.session.updateMany({
        data: {
          createdAt: new Date(Date.now() - 40 * DAY_MS),
          expiresAt: new Date(Date.now() - DAY_MS),
        },
      });
      expect((await me(body.accessToken)).statusCode).toBe(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('issues a new access token and rotates the refresh token', async () => {
      const { body: registered, refreshToken } = await signUp();
      const res = await refresh(refreshToken);

      expect(res.statusCode).toBe(200);
      const body: AuthResponse = authResponseSchema.parse(res.json());
      expect(body.user).toEqual(registered.user);
      const rotated = refreshCookieOf(res)!.value;
      expect(rotated).not.toBe(refreshToken);

      const old = await db.session.findUniqueOrThrow({
        where: { tokenHash: sha256(refreshToken) },
      });
      const next = await db.session.findUniqueOrThrow({ where: { tokenHash: sha256(rotated) } });
      expect(old.revokedAt).toBeInstanceOf(Date);
      expect(next.revokedAt).toBeNull();

      expect((await me(body.accessToken)).statusCode).toBe(200);
      // The access token tied to the rotated-out session stops working at once.
      expect((await me(registered.accessToken)).statusCode).toBe(401);
    });

    it('rejects a missing or unknown refresh token and clears the cookie', async () => {
      for (const token of [undefined, 'not-a-real-token']) {
        const res = await refresh(token);
        expect(res.statusCode).toBe(401);
        expect(errorCodeOf(res)).toBe('INVALID_REFRESH_TOKEN');
        const cleared = refreshCookieOf(res)!;
        expect(cleared.value).toBe('');
        expect(new Date(cleared.expires!).getTime()).toBeLessThanOrEqual(Date.now());
      }
    });

    it('rejects an expired refresh token without issuing a new one', async () => {
      const { refreshToken } = await signUp();
      await db.session.updateMany({
        data: {
          createdAt: new Date(Date.now() - 40 * DAY_MS),
          expiresAt: new Date(Date.now() - DAY_MS),
        },
      });

      const res = await refresh(refreshToken);
      expect(res.statusCode).toBe(401);
      expect(errorCodeOf(res)).toBe('INVALID_REFRESH_TOKEN');
      expect(refreshCookieOf(res)!.value).toBe('');
      expect(await db.session.count()).toBe(1);
    });

    it('treats reuse of a rotated token as theft and revokes every session of that user', async () => {
      const { body: registered, refreshToken: stolen } = await signUp();
      const otherDevice = authResponseSchema.parse(
        (await login('ana@example.com', PASSWORD)).json(),
      );
      const bystander = await signUp({ email: 'bystander@example.com' });

      const rotation = await refresh(stolen);
      const legitimate = refreshCookieOf(rotation)!.value;
      const rotatedAccess = authResponseSchema.parse(rotation.json()).accessToken;

      const replay = await refresh(stolen);
      expect(replay.statusCode).toBe(401);
      expect(errorCodeOf(replay)).toBe('INVALID_REFRESH_TOKEN');

      // Neither the thief nor the victim can continue; both must sign in again.
      expect((await refresh(legitimate)).statusCode).toBe(401);
      expect((await me(rotatedAccess)).statusCode).toBe(401);
      expect((await me(otherDevice.accessToken)).statusCode).toBe(401);
      expect(
        await db.session.count({ where: { userId: registered.user.id, revokedAt: null } }),
      ).toBe(0);

      // Other users are unaffected.
      expect((await me(bystander.body.accessToken)).statusCode).toBe(200);
    });

    it('lets only one of two concurrent refreshes with the same token succeed', async () => {
      const { refreshToken } = await signUp();
      const results = await Promise.all([refresh(refreshToken), refresh(refreshToken)]);
      expect(results.map((res) => res.statusCode).sort()).toEqual([200, 401]);
    });

    it('refuses requests from a foreign origin and leaves the session untouched', async () => {
      const { refreshToken } = await signUp();

      const foreign = await refresh(refreshToken, { origin: 'https://evil.example' });
      expect(foreign.statusCode).toBe(403);
      expect(errorCodeOf(foreign)).toBe('FORBIDDEN');
      expect(await db.session.count({ where: { revokedAt: null } })).toBe(1);

      const allowed = await refresh(refreshToken, { origin: 'http://localhost:5173' });
      expect(allowed.statusCode).toBe(200);
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes the session, clears the cookie, and stops both tokens working', async () => {
      const { body, refreshToken } = await signUp();

      const res = await logout(refreshToken);
      expect(res.statusCode).toBe(204);
      expect(res.body).toBe('');
      const cleared = refreshCookieOf(res)!;
      expect(cleared).toMatchObject({ value: '', path: '/api/v1/auth', httpOnly: true });
      expect(new Date(cleared.expires!).getTime()).toBeLessThanOrEqual(Date.now());

      const session = await db.session.findUniqueOrThrow({
        where: { tokenHash: sha256(refreshToken) },
      });
      expect(session.revokedAt).toBeInstanceOf(Date);
      expect((await me(body.accessToken)).statusCode).toBe(401);
      expect((await refresh(refreshToken)).statusCode).toBe(401);
    });

    it('leaves other devices signed in', async () => {
      const { refreshToken } = await signUp();
      const otherDevice = authResponseSchema.parse(
        (await login('ana@example.com', PASSWORD)).json(),
      );

      expect((await logout(refreshToken)).statusCode).toBe(204);
      expect((await me(otherDevice.accessToken)).statusCode).toBe(200);
    });

    it('succeeds without a cookie, so signing out twice is harmless', async () => {
      const res = await logout();
      expect(res.statusCode).toBe(204);
      expect(refreshCookieOf(res)!.value).toBe('');
    });
  });
});

type Claims = { sub: string; sid: string; iss: string; aud: string; iat: number; exp: number };

describe('auth rate limiting', () => {
  useTestDb();
  let app: App;

  beforeAll(async () => {
    app = await createTestApp({ AUTH_RATE_LIMIT_MAX: '2', REFRESH_RATE_LIMIT_MAX: '3' });
  });
  afterAll(() => app.close());

  const attempt = (route: string, payload?: object) =>
    app.inject({ method: 'POST', url: `${AUTH}/${route}`, ...(payload && { payload }) });

  it('limits login attempts per client, with the standard error envelope', async () => {
    const credentials = { email: 'ana@example.com', password: 'wrong password' };
    expect((await attempt('login', credentials)).statusCode).toBe(401);
    expect((await attempt('login', credentials)).statusCode).toBe(401);

    const limited = await attempt('login', credentials);
    expect(limited.statusCode).toBe(429);
    expect(errorCodeOf(limited)).toBe('TOO_MANY_REQUESTS');
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('limits registration and refresh too, each with its own budget', async () => {
    const statuses = async (route: string, times: number, payload?: object) => {
      const codes: number[] = [];
      for (let i = 0; i < times; i++) codes.push((await attempt(route, payload)).statusCode);
      return codes;
    };
    expect(await statuses('register', 3, {})).toEqual([400, 400, 429]);
    expect(await statuses('refresh', 4)).toEqual([401, 401, 401, 429]);
  });
});

describe('auth in production', () => {
  useTestDb();

  it('marks the refresh cookie Secure', async () => {
    const app = await createTestApp({
      NODE_ENV: 'production',
      LOG_LEVEL: 'silent',
      JWT_SECRET: SECRET,
    });
    const res = await app.inject({
      method: 'POST',
      url: `${AUTH}/register`,
      payload: { name: 'Ana', email: 'ana@example.com', password: PASSWORD },
    });
    await app.close();

    expect(res.statusCode).toBe(201);
    expect(refreshCookieOf(res)).toMatchObject({
      secure: true,
      httpOnly: true,
      sameSite: 'Strict',
    });
  });
});
