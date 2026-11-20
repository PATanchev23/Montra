import {
  alertsResponseSchema,
  API_PREFIX,
  budgetLimitsResponseSchema,
  budgetMonthResponseSchema,
  budgetRecommendationSchema,
  cashFlowResponseSchema,
  cashSettingsSchema,
  reportResponseSchema,
  scenarioPresetsResponseSchema,
  simulationResponseSchema,
  type BudgetGoal,
  type CashSettingsRequest,
  type ScenarioRule,
  type UpdateBudgetsRequest,
} from '@montra/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as sample from '../demo/api';
import { authorizedRequest } from './session';
import { transactionKeys } from './transactions';

/*
 * Cash flow, budgets, simulations, reports and alerts, all computed by the
 * API from the business's own transactions. Their keys sit under the
 * transactions' key, so adding, editing, deleting or importing transactions
 * refreshes every one of them, as it does the dashboard.
 */

export const financeKeys = {
  all: (businessId: string) => [...transactionKeys.all(businessId), 'finance'] as const,
  cashFlow: (businessId: string) => [...financeKeys.all(businessId), 'cash-flow'] as const,
  budgets: (businessId: string, month: string | undefined) =>
    [...financeKeys.all(businessId), 'budgets', month ?? 'current'] as const,
  recommendation: (businessId: string, goal: BudgetGoal) =>
    [...financeKeys.all(businessId), 'recommendation', goal] as const,
  presets: (businessId: string) => [...financeKeys.all(businessId), 'presets'] as const,
  simulation: (businessId: string, rule: ScenarioRule) =>
    [...financeKeys.all(businessId), 'simulation', rule] as const,
  report: (businessId: string, year: number | undefined) =>
    [...financeKeys.all(businessId), 'report', year ?? 'current'] as const,
  alerts: (businessId: string) => [...financeKeys.all(businessId), 'alerts'] as const,
};

const base = (businessId: string) => `${API_PREFIX}/businesses/${encodeURIComponent(businessId)}`;

/** A rule as query parameters; the API reads it back with scenarioQuerySchema. */
export function ruleQuery(rule: ScenarioRule): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(rule)) {
    if (value !== undefined) query.set(key, String(value));
  }
  return query.toString();
}

export function useCashFlow(businessId: string) {
  return useQuery({
    queryKey: financeKeys.cashFlow(businessId),
    queryFn: ({ signal }) =>
      authorizedRequest(`${base(businessId)}/cash-flow`, {
        schema: cashFlowResponseSchema,
        signal,
      }),
  });
}

export function useUpdateCashSettings(businessId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CashSettingsRequest) =>
      authorizedRequest(`${base(businessId)}/cash-settings`, {
        method: 'PUT',
        body,
        schema: cashSettingsSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: financeKeys.all(businessId) }),
  });
}

/** `month` is yyyy-mm; undefined is this month in the business's time zone. */
export function useBudgets(businessId: string, month: string | undefined) {
  return useQuery({
    queryKey: financeKeys.budgets(businessId, month),
    queryFn: ({ signal }) =>
      authorizedRequest(`${base(businessId)}/budgets${month ? `?month=${month}` : ''}`, {
        schema: budgetMonthResponseSchema,
        signal,
      }),
    placeholderData: keepPreviousData,
  });
}

/** Limits Montra recommends from the business's history, for the chosen goal. */
export function useBudgetRecommendation(businessId: string, goal: BudgetGoal) {
  return useQuery({
    queryKey: financeKeys.recommendation(businessId, goal),
    queryFn: ({ signal }) =>
      authorizedRequest(`${base(businessId)}/budgets/recommendation?goal=${goal}`, {
        schema: budgetRecommendationSchema,
        signal,
      }),
    placeholderData: keepPreviousData,
  });
}

export function useUpdateBudgets(businessId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateBudgetsRequest) =>
      authorizedRequest(`${base(businessId)}/budgets`, {
        method: 'PUT',
        body,
        schema: budgetLimitsResponseSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: financeKeys.all(businessId) }),
  });
}

export function useScenarioPresets(businessId: string) {
  return useQuery({
    queryKey: financeKeys.presets(businessId),
    queryFn: ({ signal }) =>
      authorizedRequest(`${base(businessId)}/simulations`, {
        schema: scenarioPresetsResponseSchema,
        signal,
      }),
  });
}

const simulationQuery = (businessId: string, rule: ScenarioRule) => ({
  queryKey: financeKeys.simulation(businessId, rule),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    authorizedRequest(`${base(businessId)}/simulations/run?${ruleQuery(rule)}`, {
      schema: simulationResponseSchema,
      signal,
    }),
});

/** The plan with and without `rule`; off until there is a rule to run. */
export function useSimulation(businessId: string, rule: ScenarioRule | undefined) {
  return useQuery({
    ...simulationQuery(businessId, rule ?? {}),
    enabled: rule !== undefined,
    placeholderData: keepPreviousData,
  });
}

/**
 * Runs a scenario ahead of time, as the pointer or focus reaches it, so that
 * choosing it shows its result at once. A recent result is not fetched again.
 */
export function usePrefetchSimulation(businessId: string) {
  const queryClient = useQueryClient();
  return (rule: ScenarioRule) => {
    void queryClient.prefetchQuery(simulationQuery(businessId, rule));
  };
}

export function useReport(businessId: string, year: number | undefined) {
  return useQuery({
    queryKey: financeKeys.report(businessId, year),
    queryFn: ({ signal }) =>
      authorizedRequest(`${base(businessId)}/reports${year ? `?year=${year}` : ''}`, {
        schema: reportResponseSchema,
        signal,
      }),
    placeholderData: keepPreviousData,
  });
}

export function useAlerts(businessId: string) {
  return useQuery({
    queryKey: financeKeys.alerts(businessId),
    queryFn: ({ signal }) =>
      authorizedRequest(`${base(businessId)}/alerts`, { schema: alertsResponseSchema, signal }),
  });
}

/**
 * The sign-in page's illustration: the TechStore sample, since nobody is
 * signed in yet to show their own figures.
 */
export function useSampleCashFlow() {
  return useQuery({ queryKey: ['sample', 'cash-flow'], queryFn: sample.getCashFlow });
}
export const SAMPLE_TODAY = sample.DEMO_TODAY;
