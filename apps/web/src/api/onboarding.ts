import {
  API_PREFIX,
  completeOnboardingResponseSchema,
  onboardingProgressSchema,
  type CurrentUserResponse,
  type OnboardingProgress,
  type SaveOnboardingRequest,
} from '@montra/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { authKeys } from './auth';
import { authorizedRequest } from './session';

const ONBOARDING = `${API_PREFIX}/onboarding`;

export const onboardingKeys = { progress: ['onboarding'] as const };

export const onboardingProgressQuery = {
  queryKey: onboardingKeys.progress,
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    authorizedRequest(ONBOARDING, { schema: onboardingProgressSchema, signal }),
};

/** The signed-in user's saved onboarding step and draft. */
export function useOnboardingProgress({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ ...onboardingProgressQuery, enabled });
}

/** Caches progress the API returned, and keeps the summary in /auth/me in step with it. */
function storeProgress(queryClient: QueryClient, progress: OnboardingProgress) {
  queryClient.setQueryData(onboardingKeys.progress, progress);
  queryClient.setQueryData<CurrentUserResponse>(
    authKeys.me,
    (me) =>
      me && { ...me, onboarding: { status: progress.status, currentStep: progress.currentStep } },
  );
}

/** Saves the current step and replaces the saved draft. */
export function useSaveOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: SaveOnboardingRequest) =>
      authorizedRequest(ONBOARDING, {
        method: 'PUT',
        body: request,
        schema: onboardingProgressSchema,
      }),
    onSuccess: (progress) => storeProgress(queryClient, progress),
  });
}

/** Asks the API to create the business from the saved draft, with the user as its OWNER. */
export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      authorizedRequest(`${ONBOARDING}/complete`, {
        method: 'POST',
        schema: completeOnboardingResponseSchema,
      }),
    onSuccess: ({ onboarding, membership }) => {
      // The membership first: with it, the route guards open the financial app.
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
      storeProgress(queryClient, onboarding);
      // Confirm against the server in the background.
      void queryClient.invalidateQueries({ queryKey: authKeys.me });
    },
  });
}
