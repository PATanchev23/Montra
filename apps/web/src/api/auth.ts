import {
  API_PREFIX,
  authResponseSchema,
  currentUserResponseSchema,
  type AuthResponse,
  type CurrentUserResponse,
  type DeleteAccountRequest,
  type LoginRequest,
  type RegisterRequest,
} from '@montra/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiRequest } from './client';
import { authorizedRequest, endDeletedSession, signIn, signOut, useSession } from './session';

const AUTH = `${API_PREFIX}/auth`;

export const authKeys = { me: ['auth', 'me'] as const };

export function fetchCurrentUser(signal?: AbortSignal): Promise<CurrentUserResponse> {
  return authorizedRequest(`${AUTH}/me`, { schema: currentUserResponseSchema, signal });
}

const currentUserQuery = {
  queryKey: authKeys.me,
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchCurrentUser(signal),
};

/** Who is signed in, which businesses they can open, and their onboarding status. */
export function useCurrentUser() {
  const { status } = useSession();
  return useQuery({ ...currentUserQuery, enabled: status === 'authenticated' });
}

/**
 * Signs in, then loads the profile from /auth/me before resolving, so the
 * form stays busy until the next page has what it needs.
 */
async function signInAndLoad(
  queryClient: QueryClient,
  request: () => Promise<AuthResponse>,
): Promise<CurrentUserResponse> {
  await signIn(request);
  return queryClient.fetchQuery(currentUserQuery);
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginRequest) =>
      signInAndLoad(queryClient, () =>
        apiRequest(`${AUTH}/login`, { method: 'POST', body: input, schema: authResponseSchema }),
      ),
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterRequest) =>
      signInAndLoad(queryClient, () =>
        apiRequest(`${AUTH}/register`, { method: 'POST', body: input, schema: authResponseSchema }),
      ),
  });
}

export function useLogout() {
  return useMutation({ mutationFn: signOut });
}

/**
 * Deletes the signed-in user's account after checking their password, then
 * signs out in every tab. A failure (such as a wrong password) leaves the
 * session as it was.
 */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: async (input: DeleteAccountRequest) => {
      await authorizedRequest(`${AUTH}/me`, { method: 'DELETE', body: input, schema: z.unknown() });
      endDeletedSession();
    },
  });
}
