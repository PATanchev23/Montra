import { BUSINESS_LIMITS, type CurrentUserResponse, type MembershipSummary } from '@montra/shared';
import { createContext, use } from 'react';
import { useBilling } from '../../api/billing';
import { useUiStore } from '../../stores/ui';

/** Provided by RequireAuth once /auth/me has loaded. */
export const CurrentUserContext = createContext<CurrentUserResponse | null>(null);

/** The signed-in user's profile, memberships and onboarding status. Only inside RequireAuth. */
export function useSignedInUser(): CurrentUserResponse {
  const me = use(CurrentUserContext);
  if (!me) throw new Error('useSignedInUser must be used inside RequireAuth');
  return me;
}

/**
 * The business the app is showing, and the user's role in it: the one last
 * chosen in the business switcher, or the user's first while none is chosen
 * (or the chosen one can no longer be opened). Only inside RequireBusiness,
 * which guarantees one.
 */
export function useCurrentMembership(): MembershipSummary {
  const { memberships } = useSignedInUser();
  const chosen = useUiStore((s) => s.businessId);
  const membership = memberships.find((m) => m.business.id === chosen) ?? memberships[0];
  if (!membership) throw new Error('useCurrentMembership must be used inside RequireBusiness');
  return membership;
}

/**
 * Whether the account may add another business: it owns at least one (the
 * first comes from onboarding) and fewer than its plan allows. Only owned
 * businesses count. The API enforces the same rule; this only decides what
 * the interface offers. While the plan is loading, nothing is offered.
 */
export function useBusinessAllowance() {
  const { memberships } = useSignedInUser();
  const plan = useBilling().data?.plan;
  const owned = memberships.filter((m) => m.role === 'OWNER').length;
  const limit = plan ? BUSINESS_LIMITS[plan] : undefined;
  return {
    plan,
    owned,
    limit,
    isOwner: owned > 0,
    canAdd: limit !== undefined && owned > 0 && owned < limit,
  };
}
