import { keepPreviousData, useQuery } from '@tanstack/react-query';
import * as sample from '../demo/api';
import { useLanguage } from '../i18n';

/*
 * Query hooks for financial data the API does not serve yet. They resolve
 * against the deterministic TechStore sample layer (src/demo). Transactions,
 * imports and the dashboard already come from the API (see transactions.ts,
 * imports.ts, dashboard.ts).
 * When the remaining REST endpoints land, only the queryFn bodies change and
 * every page keeps working, including loading and error states.
 */

/*
 * The sample layer writes its labels (categories, scenarios, notifications) in
 * the interface language, so every key ends with the language: a switch reads
 * fresh text instead of the cached text of the other language.
 */
export const financeKeys = {
  cashFlow: (lang: string) => ['cash-flow', lang] as const,
  budgets: (offset: number, lang: string) => ['budgets', offset, lang] as const,
  scenarios: (lang: string) => ['scenarios', lang] as const,
  scenario: (id: string, lang: string) => ['scenarios', id, lang] as const,
  report: (year: number, lang: string) => ['report', year, lang] as const,
  notifications: (lang: string) => ['notifications', lang] as const,
  upcoming: (limit: number, lang: string) => ['upcoming', limit, lang] as const,
};

export function useCashFlow() {
  const lang = useLanguage();
  return useQuery({ queryKey: financeKeys.cashFlow(lang), queryFn: sample.getCashFlow });
}

export function useBudgets(offset: number) {
  const lang = useLanguage();
  return useQuery({
    queryKey: financeKeys.budgets(offset, lang),
    queryFn: () => sample.getBudgets(offset),
    placeholderData: keepPreviousData,
  });
}

export function useScenarios() {
  const lang = useLanguage();
  return useQuery({ queryKey: financeKeys.scenarios(lang), queryFn: sample.listScenarios });
}

export function useScenarioResult(id: string | undefined) {
  const lang = useLanguage();
  return useQuery({
    queryKey: financeKeys.scenario(id ?? '', lang),
    queryFn: () => sample.getScenarioResult(id!),
    enabled: Boolean(id),
    placeholderData: keepPreviousData,
  });
}

export function useReport(year: number) {
  const lang = useLanguage();
  return useQuery({
    queryKey: financeKeys.report(year, lang),
    queryFn: () => sample.getReport(year),
    placeholderData: keepPreviousData,
  });
}

/** The next scheduled payments and expected payouts, soonest first. */
export function useUpcomingPayments(limit = 5) {
  const lang = useLanguage();
  return useQuery({
    queryKey: financeKeys.upcoming(limit, lang),
    queryFn: async () => sample.upcomingItems(30).slice(0, limit),
  });
}

export function useNotifications() {
  const lang = useLanguage();
  return useQuery({ queryKey: financeKeys.notifications(lang), queryFn: sample.getNotifications });
}

export { exportTransactions } from '../demo/api';
export { accounts, business, categories, DEMO_TODAY, FORECAST_DAYS } from '../demo/api';
