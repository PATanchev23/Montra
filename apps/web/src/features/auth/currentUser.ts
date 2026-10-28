import type { CurrentUserResponse } from '@montra/shared';
import { createContext, use } from 'react';

/** Provided by RequireAuth once /auth/me has loaded. */
export const CurrentUserContext = createContext<CurrentUserResponse | null>(null);

/** The signed-in user's profile, memberships and onboarding status. Only inside RequireAuth. */
export function useSignedInUser(): CurrentUserResponse {
  const me = use(CurrentUserContext);
  if (!me) throw new Error('useSignedInUser must be used inside RequireAuth');
  return me;
}
