import { keepPreviousData, useQuery } from '@tanstack/react-query';
import * as sample from '../demo/api';

/*
 * Query hooks for financial data the API does not serve yet. They resolve
 * against the deterministic TechStore sample layer (src/demo). Transactions,
 * imports and the dashboard already come from the API (see transactions.ts,
 * imports.ts, dashboard.ts).
 * When the remaining REST endpoints land, only the queryFn bodies change and
 * every page keeps working, including loading and error states.
 */

export const financeKeys = {
  cashFlow: ['cash-flow'] as const,
  budgets: (offset: number) => ['budgets', offset] as const,
  scenarios: ['scenarios'] as const,
  scenario: (id: string) => ['scenarios', id] as const,
  report: (year: number) => ['report', year] as const,
  notifications: ['notifications'] as const,
};

export function useCashFlow() {
  return useQuery({ queryKey: financeKeys.cashFlow, queryFn: sample.getCashFlow });
}

export function useBudgets(offset: number) {
  return useQuery({
    queryKey: financeKeys.budgets(offset),
    queryFn: () => sample.getBudgets(offset),
    placeholderData: keepPreviousData,
  });
}

export function useScenarios() {
  return useQuery({ queryKey: financeKeys.scenarios, queryFn: sample.listScenarios });
}

export function useScenarioResult(id: string | undefined) {
  return useQuery({
    queryKey: financeKeys.scenario(id ?? ''),
    queryFn: () => sample.getScenarioResult(id!),
    enabled: Boolean(id),
    placeholderData: keepPreviousData,
  });
}

export function useReport(year: number) {
  return useQuery({
    queryKey: financeKeys.report(year),
    queryFn: () => sample.getReport(year),
    placeholderData: keepPreviousData,
  });
}

export function useNotifications() {
  return useQuery({ queryKey: financeKeys.notifications, queryFn: sample.getNotifications });
}

export { exportTransactions } from '../demo/api';
export { accounts, business, categories, DEMO_TODAY } from '../demo/api';
