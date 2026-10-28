import type { AuthResponse, CurrentUserResponse } from '@montra/shared';
import { vi } from 'vitest';

/* A fake Montra auth API for tests: routes fetch calls by "METHOD /path". */

export function jsonResponse(body: unknown, status = 200) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function apiError(status: number, code: string, message: string) {
  return jsonResponse({ error: { code, message } }, status);
}

export const profile = (overrides: Partial<CurrentUserResponse> = {}): CurrentUserResponse => ({
  user: { id: 'user-1', email: 'ana@example.com', name: 'Ana Petrova' },
  memberships: [
    {
      role: 'OWNER',
      business: {
        id: 'biz-1',
        slug: 'techstore',
        name: 'TechStore',
        currency: 'EUR',
        timezone: 'Europe/Sofia',
      },
    },
  ],
  onboarding: { status: 'COMPLETED', currentStep: 'REVIEW' },
  ...overrides,
});

export const noBusiness = (): Partial<CurrentUserResponse> => ({
  memberships: [],
  onboarding: { status: 'NOT_STARTED', currentStep: 'BUSINESS_DETAILS' },
});

let tokenCounter = 0;

/** A login/register/refresh body with a unique access token valid for `ttlMs`. */
export function authBody(me = profile(), ttlMs = 15 * 60_000): AuthResponse {
  tokenCounter += 1;
  return {
    ...me,
    accessToken: `access-${tokenCounter}`,
    accessTokenExpiresAt: new Date(Date.now() + ttlMs).toISOString(),
  };
}

type Handler = (init: RequestInit) => Response | Promise<Response>;

/** Stubs fetch. Unrouted calls fail the test loudly. */
export function mockApi(routes: Record<string, Handler>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const key = `${init.method ?? 'GET'} ${String(input)}`;
    const handler = routes[key];
    if (!handler) throw new Error(`Unexpected request: ${key}`);
    return handler(init);
  });
  vi.stubGlobal('fetch', fetchMock);

  return {
    fetchMock,
    calls: (key: string) =>
      fetchMock.mock.calls.filter(
        ([input, init]) => `${init?.method ?? 'GET'} ${String(input)}` === key,
      ),
    authorizationOf: (call: unknown[]) =>
      ((call[1] as RequestInit | undefined)?.headers as Record<string, string> | undefined)
        ?.Authorization,
  };
}
