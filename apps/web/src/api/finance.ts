import { keepPreviousData, useQuery } from '@tanstack/react-query';
import * as sample from '../demo/api';
import type { FlowRange, TransactionQuery } from '../demo/api';
import type { Period } from '../demo/types';

/*
 * Query hooks for financial data. They currently resolve against the
 * deterministic TechStore sample layer (src/demo). When the REST endpoints
 * land, only the queryFn bodies change — to `apiRequest(...)` — and every
 * page keeps working, including loading and error states.
 */

export const financeKeys = {
  dashboard: (period: Period) => ['dashboard', period] as const,
  flows: (range: FlowRange) => ['flows', range] as const,
  cashFlow: ['cash-flow'] as const,
  transactions: (query: TransactionQuery) => ['transactions', query] as const,
  budgets: (offset: number) => ['budgets', offset] as const,
  scenarios: ['scenarios'] as const,
  scenario: (id: string) => ['scenarios', id] as const,
  report: (year: number) => ['report', year] as const,
  notifications: ['notifications'] as const,
};

export function useDashboard(period: Period) {
  return useQuery({
    queryKey: financeKeys.dashboard(period),
    queryFn: () => sample.getDashboard(period),
    placeholderData: keepPreviousData,
  });
}

export function useMonthlyFlows(range: FlowRange) {
  return useQuery({
    queryKey: financeKeys.flows(range),
    queryFn: () => sample.getMonthlyFlows(range),
    placeholderData: keepPreviousData,
  });
}

export function useCashFlow() {
  return useQuery({ queryKey: financeKeys.cashFlow, queryFn: sample.getCashFlow });
}

export function useTransactions(query: TransactionQuery) {
  return useQuery({
    queryKey: financeKeys.transactions(query),
    queryFn: () => sample.listTransactions(query),
    placeholderData: keepPreviousData,
  });
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

export { describePeriod, exportTransactions, listPeriods, rangeBounds } from '../demo/api';
export { accounts, business, categories, DEMO_TODAY } from '../demo/api';
