import {
  API_PREFIX,
  businessResponseSchema,
  createBusinessResponseSchema,
  type CreateBusinessRequest,
  type CurrentUserResponse,
} from '@montra/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authKeys } from './auth';
import { authorizedRequest } from './session';

export const businessKeys = {
  profile: (businessId: string) => ['business', businessId] as const,
};

/**
 * Adds another business, with the caller as its OWNER (within the plan's
 * limit). The new membership joins the signed-in profile at once, so the
 * switcher lists it before the profile is re-read.
 */
export function useCreateBusiness() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateBusinessRequest) =>
      authorizedRequest(`${API_PREFIX}/businesses`, {
        method: 'POST',
        body: request,
        schema: createBusinessResponseSchema,
      }),
    onSuccess: ({ membership }) => {
      queryClient.setQueryData<CurrentUserResponse>(
        authKeys.me,
        (me) =>
          me && {
            ...me,
            memberships: [
              ...me.memberships.filter((m) => m.business.id !== membership.business.id),
              membership,
            ],
          },
      );
      void queryClient.invalidateQueries({ queryKey: authKeys.me });
    },
  });
}

/** The business with the settings chosen during onboarding, and the caller's role in it. */
export function useBusinessProfile(businessId: string) {
  return useQuery({
    queryKey: businessKeys.profile(businessId),
    queryFn: ({ signal }) =>
      authorizedRequest(`${API_PREFIX}/businesses/${encodeURIComponent(businessId)}`, {
        schema: businessResponseSchema,
        signal,
      }),
    enabled: businessId !== '',
  });
}
