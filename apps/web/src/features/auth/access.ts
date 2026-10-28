import type { CurrentUserResponse } from '@montra/shared';

/**
 * Whether the user can open the financial app. Onboarding creates the owner's
 * business and membership; viewers join an existing business without ever
 * onboarding. So a membership, not the onboarding status alone, is the test.
 */
export function hasBusinessAccess(me: CurrentUserResponse): boolean {
  return me.memberships.length > 0;
}

/** Where /login sends the user back to: the page they were stopped at, or the dashboard. */
export function returnPathFrom(state: unknown): string {
  const from = (state as { from?: { pathname?: unknown; search?: unknown; hash?: unknown } } | null)
    ?.from;
  if (!from || typeof from.pathname !== 'string') return '/';
  // Only same-app paths; "//host" would leave the site.
  if (!from.pathname.startsWith('/') || from.pathname.startsWith('//')) return '/';
  if (from.pathname === '/login' || from.pathname === '/register') return '/';
  const search = typeof from.search === 'string' ? from.search : '';
  const hash = typeof from.hash === 'string' ? from.hash : '';
  return `${from.pathname}${search}${hash}`;
}

/** First word of the user's name, for greetings. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
