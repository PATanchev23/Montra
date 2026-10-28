import {
  API_PREFIX,
  AUTH_ERROR_CODES,
  authResponseSchema,
  type AuthResponse,
} from '@montra/shared';
import { useSyncExternalStore } from 'react';
import { z } from 'zod';
import { ApiError, apiRequest, type RequestOptions } from './client';

/*
 * The browser session.
 *
 * The access token lives only in this module's memory. The refresh token is
 * an httpOnly cookie that JavaScript never sees, and every tab shares it.
 * Each refresh rotates that cookie and ends the session behind the previous
 * access token, which has two consequences:
 *
 *  - Refreshes run one at a time across all tabs, under a Web Lock. If two
 *    tabs sent the same refresh token, the API would treat the second as
 *    stolen and revoke every session the user has.
 *  - A tab that gets a new access token passes it to the other tabs over a
 *    BroadcastChannel (memory to memory, never storage), because their old
 *    token has just stopped working. One refresh therefore serves every tab.
 */

const AUTH = `${API_PREFIX}/auth`;
const LOCK_NAME = 'montra:session';
/** Tokens this close to expiry are refreshed before use rather than sent and rejected. */
const EXPIRY_MARGIN_MS = 30_000;

export type SessionStatus = 'loading' | 'authenticated' | 'anonymous' | 'unavailable';
/** Why this tab was signed out, so the login page can say so. */
export type SignOutReason = 'signed-out' | 'expired';

export interface SessionState {
  status: SessionStatus;
  userId: string | null;
  signOutReason: SignOutReason | null;
  /** Set when status is 'unavailable': why the session could not be restored. */
  problem: string | null;
}

interface AccessToken {
  value: string;
  expiresAt: number;
}

type SessionMessage =
  | { type: 'session'; userId: string; token: AccessToken }
  | { type: 'signed-out'; reason: SignOutReason };

const initialState: SessionState = {
  status: 'loading',
  userId: null,
  signOutReason: null,
  problem: null,
};

let state = initialState;
let accessToken: AccessToken | null = null;
let refreshing: Promise<string> | null = null;
const listeners = new Set<() => void>();
const userChangeListeners = new Set<() => void>();

const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(LOCK_NAME);
channel?.addEventListener('message', (event: MessageEvent<SessionMessage>) => {
  const message = event.data;
  if (message.type === 'session') adopt(message.userId, message.token);
  else endSession(message.reason, { broadcast: false });
});

function setState(next: Partial<SessionState>) {
  const userChanged = next.userId !== undefined && next.userId !== state.userId;
  state = { ...state, ...next };
  // Synchronously, so cached data from the previous user is gone before anything renders.
  if (userChanged) userChangeListeners.forEach((listener) => listener());
  listeners.forEach((listener) => listener());
}

function isFresh(token: AccessToken): boolean {
  return token.expiresAt - Date.now() > EXPIRY_MARGIN_MS;
}

function adopt(userId: string, token: AccessToken) {
  accessToken = token;
  setState({ status: 'authenticated', userId, signOutReason: null, problem: null });
}

function startSession(session: AuthResponse): string {
  const token = {
    value: session.accessToken,
    expiresAt: Date.parse(session.accessTokenExpiresAt),
  };
  adopt(session.user.id, token);
  channel?.postMessage({
    type: 'session',
    userId: session.user.id,
    token,
  } satisfies SessionMessage);
  return token.value;
}

function endSession(reason: SignOutReason | null, { broadcast }: { broadcast: boolean }) {
  if (state.status === 'anonymous') return;
  accessToken = null;
  setState({ status: 'anonymous', userId: null, signOutReason: reason, problem: null });
  if (broadcast && reason)
    channel?.postMessage({ type: 'signed-out', reason } satisfies SessionMessage);
}

/** Without Web Locks (older browsers), tasks are still serialised within this tab. */
let localQueue: Promise<unknown> = Promise.resolve();

function withSessionLock<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(LOCK_NAME, task);
  }
  const run = localQueue.then(task, task);
  localQueue = run.catch(() => undefined);
  return run;
}

const isAuthError = (err: unknown, code: string) =>
  err instanceof ApiError && err.status === 401 && err.code === code;

const signedOutError = () =>
  new ApiError(401, AUTH_ERROR_CODES.INVALID_REFRESH_TOKEN, 'Sign in to continue.');

/**
 * Returns a usable access token, refreshing only if `stale` is still the
 * current one: another request in this tab, or another tab, may already have
 * replaced it while this call waited for the lock. Concurrent callers in this
 * tab share one refresh.
 */
function refreshAccessToken(stale: string | null): Promise<string> {
  refreshing ??= withSessionLock(async () => {
    if (accessToken && isFresh(accessToken) && accessToken.value !== stale) {
      return accessToken.value;
    }
    if (state.status === 'anonymous') throw signedOutError();
    try {
      const session = await apiRequest(`${AUTH}/refresh`, {
        method: 'POST',
        schema: authResponseSchema,
      });
      return startSession(session);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Only a session that was live has "ended"; a first visit just isn't signed in.
        const wasSignedIn = state.status === 'authenticated';
        endSession(wasSignedIn ? 'expired' : null, { broadcast: wasSignedIn });
      }
      throw err;
    }
  }).finally(() => {
    refreshing = null;
  });
  // A refresh that was already finishing may hand back the very token this
  // caller needs replaced; then it takes its own turn.
  return refreshing.then((token) => (token === stale ? refreshAccessToken(stale) : token));
}

/**
 * Restores the session from the refresh cookie. Runs on page load (the access
 * token does not survive one) and when the user retries after a failure.
 */
export function restoreSession(): void {
  setState({ status: 'loading', problem: null });
  refreshAccessToken(null).catch((err: unknown) => {
    if (err instanceof ApiError && err.status === 401) return;
    setState({
      status: 'unavailable',
      problem: err instanceof Error ? err.message : 'Could not restore your session.',
    });
  });
}

/** Runs a login or registration request and starts the session it returns. */
export async function signIn(request: () => Promise<AuthResponse>): Promise<AuthResponse> {
  return withSessionLock(async () => {
    const session = await request();
    startSession(session);
    return session;
  });
}

/**
 * Ends the session on the server, then here and in every other tab. Signing
 * out locally always happens: the user asked to leave this device.
 */
export async function signOut(): Promise<void> {
  await withSessionLock(async () => {
    try {
      await apiRequest(`${AUTH}/logout`, { method: 'POST', schema: z.unknown() });
    } catch {
      // Unreachable server: the refresh cookie outlives this, but the tab is still signed out.
    }
  });
  endSession('signed-out', { broadcast: true });
}

async function getAccessToken(): Promise<string> {
  if (accessToken && isFresh(accessToken)) return accessToken.value;
  if (state.status === 'anonymous') throw signedOutError();
  return refreshAccessToken(accessToken?.value ?? null);
}

/**
 * `apiRequest` for endpoints that need a signed-in user. Refreshes the access
 * token when it is about to expire, and once more if the API rejects it.
 */
export async function authorizedRequest<S extends z.ZodType>(
  path: string,
  options: RequestOptions<S>,
): Promise<z.output<S>> {
  const send = (token: string) =>
    apiRequest(path, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${token}` },
    });

  const token = await getAccessToken();
  try {
    return await send(token);
  } catch (err) {
    if (!isAuthError(err, AUTH_ERROR_CODES.INVALID_ACCESS_TOKEN)) throw err;
    return send(await refreshAccessToken(token));
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSession(): SessionState {
  return state;
}

export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, getSession);
}

/** Called whenever the signed-in user changes, including on sign-in and sign-out. */
export function onUserChange(listener: () => void): () => void {
  userChangeListeners.add(listener);
  return () => {
    userChangeListeners.delete(listener);
  };
}

/** Test-only: forget the session without touching the network. */
export function resetSessionForTests(): void {
  accessToken = null;
  refreshing = null;
  state = initialState;
  listeners.forEach((listener) => listener());
}
