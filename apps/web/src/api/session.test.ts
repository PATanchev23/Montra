import { currentUserResponseSchema } from '@montra/shared';
import { waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiError, authBody, jsonResponse, mockApi, profile } from '../test/authApi';
import {
  authorizedRequest,
  getSession,
  onUserChange,
  resetSessionForTests,
  restoreSession,
  signIn,
  signOut,
} from './session';

const ME = 'GET /api/v1/auth/me';
const REFRESH = 'POST /api/v1/auth/refresh';
const LOGOUT = 'POST /api/v1/auth/logout';

const fetchMe = () => authorizedRequest('/api/v1/auth/me', { schema: currentUserResponseSchema });

const sessionEnded = () =>
  apiError(401, 'INVALID_REFRESH_TOKEN', 'Your session has ended. Sign in again.');

async function restored() {
  restoreSession();
  await waitFor(() => expect(getSession().status).not.toBe('loading'));
  return getSession();
}

beforeEach(() => resetSessionForTests());
afterEach(() => resetSessionForTests());

describe('restoring the session on page load', () => {
  it('signs in from the refresh cookie and sends the new access token', async () => {
    const body = authBody();
    const api = mockApi({
      [REFRESH]: () => jsonResponse(body),
      [ME]: () => jsonResponse(profile()),
    });

    expect(await restored()).toMatchObject({ status: 'authenticated', userId: 'user-1' });
    await fetchMe();

    const [meCall] = api.calls(ME);
    expect(api.authorizationOf(meCall!)).toBe(`Bearer ${body.accessToken}`);
    // The refresh request relies on the httpOnly cookie, never a token in JS.
    const [refreshCall] = api.calls(REFRESH);
    expect(refreshCall![1]).toMatchObject({ credentials: 'include', body: undefined });
  });

  it('treats a missing or rejected refresh cookie as signed out, without a "session ended" notice', async () => {
    mockApi({ [REFRESH]: sessionEnded });

    expect(await restored()).toMatchObject({ status: 'anonymous', signOutReason: null });
  });

  it('reports the API as unavailable rather than signing the user out', async () => {
    mockApi({
      [REFRESH]: () => {
        throw new TypeError('Failed to fetch');
      },
    });

    expect(await restored()).toMatchObject({
      status: 'unavailable',
      problem: 'Could not reach the Montra API.',
    });
  });
});

describe('access token expiry', () => {
  it('refreshes a token that is about to expire before using it', async () => {
    const first = authBody(profile(), 10_000); // inside the 30-second safety margin
    const second = authBody();
    const refreshes = [first, second];
    const api = mockApi({
      [REFRESH]: () => jsonResponse(refreshes.shift()),
      [ME]: () => jsonResponse(profile()),
    });
    await restored();

    await fetchMe();

    expect(api.calls(REFRESH)).toHaveLength(2);
    expect(api.authorizationOf(api.calls(ME)[0]!)).toBe(`Bearer ${second.accessToken}`);
  });

  it('refreshes and retries once when the API rejects the access token', async () => {
    const first = authBody();
    const second = authBody();
    const refreshes = [first, second];
    const api = mockApi({
      [REFRESH]: () => jsonResponse(refreshes.shift()),
      [ME]: (init) =>
        (init.headers as Record<string, string>).Authorization === `Bearer ${first.accessToken}`
          ? apiError(401, 'INVALID_ACCESS_TOKEN', 'Sign in to continue.')
          : jsonResponse(profile()),
    });
    await restored();

    await expect(fetchMe()).resolves.toEqual(profile());
    expect(api.calls(ME).map((call) => api.authorizationOf(call))).toEqual([
      `Bearer ${first.accessToken}`,
      `Bearer ${second.accessToken}`,
    ]);
  });

  it('sends one refresh for many requests that find the token expired at once', async () => {
    const refreshes = [authBody(profile(), 1_000), authBody()];
    let resolveRefresh: (() => void) | undefined;
    const api = mockApi({
      [REFRESH]: async () => {
        const body = refreshes.shift();
        if (refreshes.length === 0) await new Promise<void>((r) => (resolveRefresh = r));
        return jsonResponse(body);
      },
      [ME]: () => jsonResponse(profile()),
    });
    await restored();

    const requests = Promise.all([fetchMe(), fetchMe(), fetchMe()]);
    await waitFor(() => expect(resolveRefresh).toBeDefined());
    resolveRefresh!();
    await requests;

    // One on page load, one for all three requests.
    expect(api.calls(REFRESH)).toHaveLength(2);
    expect(api.calls(ME)).toHaveLength(3);
  });

  it('signs out with an "expired" notice when the refresh is rejected mid-session', async () => {
    const refreshes = [() => jsonResponse(authBody(profile(), 1_000)), sessionEnded];
    mockApi({ [REFRESH]: () => refreshes.shift()!() });
    const userChanged = vi.fn();
    const unsubscribe = onUserChange(userChanged);
    await restored();
    userChanged.mockClear();

    await expect(fetchMe()).rejects.toMatchObject({ status: 401, code: 'INVALID_REFRESH_TOKEN' });

    expect(getSession()).toMatchObject({
      status: 'anonymous',
      userId: null,
      signOutReason: 'expired',
    });
    expect(userChanged).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it('does not try to refresh once signed out', async () => {
    const api = mockApi({ [REFRESH]: sessionEnded });
    await restored();

    await expect(fetchMe()).rejects.toMatchObject({ status: 401 });
    expect(api.calls(REFRESH)).toHaveLength(1);
  });
});

describe('cross-tab coordination', () => {
  it('runs refresh, sign-in and sign-out under one Web Lock', async () => {
    const lockNames: string[] = [];
    let tail = Promise.resolve<unknown>(undefined);
    vi.stubGlobal('navigator', {
      ...navigator,
      locks: {
        // An exclusive lock: callbacks run strictly one after another.
        request: (name: string, callback: () => Promise<unknown>) => {
          lockNames.push(name);
          const run = tail.then(callback);
          tail = run.catch(() => undefined);
          return run;
        },
      },
    });
    mockApi({
      [REFRESH]: sessionEnded,
      [LOGOUT]: () => new Response(null, { status: 204 }),
    });

    await restored();
    await signIn(async () => authBody());
    await signOut();

    expect(lockNames).toEqual(['montra:session', 'montra:session', 'montra:session']);
  });
});

describe('signing in and out', () => {
  it('starts a session from a login response and keeps tokens out of web storage', async () => {
    mockApi({ [REFRESH]: sessionEnded });
    await restored();
    const body = authBody();

    await signIn(async () => body);

    expect(getSession()).toMatchObject({ status: 'authenticated', userId: 'user-1' });
    const stored = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });
    expect(stored).not.toContain(body.accessToken);
  });

  it('ends the session on the server and locally', async () => {
    const api = mockApi({
      [REFRESH]: () => jsonResponse(authBody()),
      [LOGOUT]: () => new Response(null, { status: 204 }),
    });
    await restored();

    await signOut();

    expect(api.calls(LOGOUT)).toHaveLength(1);
    expect(getSession()).toMatchObject({ status: 'anonymous', signOutReason: 'signed-out' });
  });

  it('still signs out locally when the server cannot be reached', async () => {
    mockApi({
      [REFRESH]: () => jsonResponse(authBody()),
      [LOGOUT]: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    await restored();

    await signOut();

    expect(getSession().status).toBe('anonymous');
  });
});
