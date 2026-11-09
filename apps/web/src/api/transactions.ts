import {
  API_PREFIX,
  transactionCategoryListResponseSchema,
  transactionListResponseSchema,
  transactionSchema,
  type CreateTransactionRequest,
  type TransactionSort,
  type TransactionType,
  type UpdateTransactionRequest,
} from '@montra/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { authorizedRequest } from './session';

/*
 * Transaction history and changes, from /businesses/:businessId/transactions.
 * The API checks membership and role on every request; the UI only mirrors
 * those rules.
 */

const transactionsPath = (businessId: string) =>
  `${API_PREFIX}/businesses/${encodeURIComponent(businessId)}/transactions`;

/** The list query, as the API takes it. Left-out filters are not applied. */
export interface TransactionListParams {
  page: number;
  pageSize: number;
  sort: TransactionSort;
  type?: TransactionType;
  category?: string;
  from?: string;
  to?: string;
}

export const transactionKeys = {
  /** Everything cached for one business's transactions: invalidated after any change. */
  all: (businessId: string) => ['transactions', businessId] as const,
  list: (businessId: string, params: TransactionListParams) =>
    ['transactions', businessId, 'list', params] as const,
  categories: (businessId: string) => ['transactions', businessId, 'categories'] as const,
};

export function listQueryString(params: TransactionListParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  return query.toString();
}

export function fetchTransactions(
  businessId: string,
  params: TransactionListParams,
  signal?: AbortSignal,
) {
  return authorizedRequest(`${transactionsPath(businessId)}?${listQueryString(params)}`, {
    schema: transactionListResponseSchema,
    signal,
  });
}

/** One page of history. The previous page stays on screen while the next loads. */
export function useTransactionList(
  businessId: string,
  params: TransactionListParams,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: transactionKeys.list(businessId, params),
    queryFn: ({ signal }) => fetchTransactions(businessId, params, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Categories in use, for the filter and the form's suggestions. */
export function useTransactionCategories(businessId: string) {
  return useQuery({
    queryKey: transactionKeys.categories(businessId),
    queryFn: ({ signal }) =>
      authorizedRequest(`${transactionsPath(businessId)}/categories`, {
        schema: transactionCategoryListResponseSchema,
        signal,
      }),
  });
}

function useInvalidateTransactions(businessId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: transactionKeys.all(businessId) });
}

export function useCreateTransaction(businessId: string) {
  const invalidate = useInvalidateTransactions(businessId);
  return useMutation({
    mutationFn: (request: CreateTransactionRequest) =>
      authorizedRequest(transactionsPath(businessId), {
        method: 'POST',
        body: request,
        schema: transactionSchema,
      }),
    onSuccess: invalidate,
  });
}

export function useUpdateTransaction(businessId: string) {
  const invalidate = useInvalidateTransactions(businessId);
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: UpdateTransactionRequest }) =>
      authorizedRequest(`${transactionsPath(businessId)}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: changes,
        schema: transactionSchema,
      }),
    onSuccess: invalidate,
  });
}

export function useDeleteTransaction(businessId: string) {
  const invalidate = useInvalidateTransactions(businessId);
  return useMutation({
    mutationFn: (id: string) =>
      authorizedRequest(`${transactionsPath(businessId)}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        // 204: no body.
        schema: z.unknown(),
      }),
    onSuccess: invalidate,
  });
}
