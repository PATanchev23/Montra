import {
  API_PREFIX,
  billingRedirectSchema,
  billingResponseSchema,
  type PaidPlanId,
} from '@montra/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { authorizedRequest } from './session';

/*
 * The signed-in account's plan, from /billing. Paying, changing card and
 * cancelling happen on Stripe's own pages: the API hands back where to go and
 * the browser leaves Montra for it.
 */

export const billingKeys = { all: ['billing'] as const };

export function useBilling({ pollWhileFree = false }: { pollWhileFree?: boolean } = {}) {
  return useQuery({
    queryKey: billingKeys.all,
    queryFn: ({ signal }) =>
      authorizedRequest(`${API_PREFIX}/billing`, { schema: billingResponseSchema, signal }),
    // Just back from checkout: Stripe's confirmation can land a few seconds after the browser.
    refetchInterval: (query) => (pollWhileFree && query.state.data?.plan === 'free' ? 2000 : false),
  });
}

/** Sends the browser to Stripe Checkout for a paid plan. */
export function useStartCheckout() {
  return useMutation({
    mutationFn: (plan: PaidPlanId) =>
      authorizedRequest(`${API_PREFIX}/billing/checkout`, {
        method: 'POST',
        body: { plan },
        schema: billingRedirectSchema,
      }),
    onSuccess: ({ url }) => window.location.assign(url),
  });
}

/** Sends the browser to Stripe's billing portal (card, plan, cancellation). */
export function useOpenBillingPortal() {
  return useMutation({
    mutationFn: () =>
      authorizedRequest(`${API_PREFIX}/billing/portal`, {
        method: 'POST',
        schema: billingRedirectSchema,
      }),
    onSuccess: ({ url }) => window.location.assign(url),
  });
}
