import type { CurrentUserResponse, MembershipSummary } from '@montra/shared';
import { createContext, use } from 'react';

/** Provided by RequireAuth once /auth/me has loaded. */
export const CurrentUserContext = createContext<CurrentUserResponse | null>(null);

/** The signed-in user's profile, memberships and onboarding status. Only inside RequireAuth. */
export function useSignedInUser(): CurrentUserResponse {
  const me = use(CurrentUserContext);
  if (!me) throw new Error('useSignedInUser must be used inside RequireAuth');
  return me;
}

/**
 * The business the app is showing, and the user's role in it. Montra opens a
 * user's first business; only inside RequireBusiness, which guarantees one.
 */
export function useCurrentMembership(): MembershipSummary {
  const [membership] = useSignedInUser().memberships;
  if (!membership) throw new Error('useCurrentMembership must be used inside RequireBusiness');
  return membership;
}
