import { API_PREFIX, businessResponseSchema } from '@montra/shared';
import { useQuery } from '@tanstack/react-query';
import { authorizedRequest } from './session';

export const businessKeys = {
  profile: (businessId: string) => ['business', businessId] as const,
};

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
