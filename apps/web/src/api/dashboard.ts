import { API_PREFIX, dashboardResponseSchema, type DashboardPeriod } from '@montra/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { authorizedRequest } from './session';
import { transactionKeys } from './transactions';

export interface DashboardParams {
  period: DashboardPeriod;
  /** Custom periods only. */
  from?: string;
  to?: string;
}

/**
 * The dashboard is derived from the transactions, so its key sits under
 * theirs: creating, changing, deleting or importing transactions invalidates
 * it along with the history.
 */
export const dashboardKeys = {
  summary: (businessId: string, params: DashboardParams) =>
    [...transactionKeys.all(businessId), 'dashboard', params] as const,
};

export function dashboardQueryString({ period, from, to }: DashboardParams): string {
  const query = new URLSearchParams({ period });
  if (period === 'custom') {
    if (from) query.set('from', from);
    if (to) query.set('to', to);
  }
  return query.toString();
}

/** Overview, trend, expense breakdown and recent transactions for one period. */
export function useDashboardSummary(
  businessId: string,
  params: DashboardParams,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: dashboardKeys.summary(businessId, params),
    queryFn: ({ signal }) =>
      authorizedRequest(
        `${API_PREFIX}/businesses/${encodeURIComponent(businessId)}/dashboard?${dashboardQueryString(params)}`,
        { schema: dashboardResponseSchema, signal },
      ),
    placeholderData: keepPreviousData,
    enabled,
  });
}
