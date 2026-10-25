/*
 * Shapes of the data the UI renders. They mirror the responses the REST API
 * will return once the financial endpoints exist, at which point these types
 * move to @montra/shared as Zod schemas.
 */

export type EntryType = 'income' | 'expense';

export type CategoryId =
  | 'sales-store'
  | 'sales-marketplace'
  | 'sales-b2b'
  | 'inventory'
  | 'advertising'
  | 'shipping'
  | 'payroll'
  | 'rent'
  | 'software'
  | 'fees'
  | 'utilities'
  | 'taxes';

export interface Category {
  id: CategoryId;
  name: string;
  type: EntryType;
}

export type AccountId = 'main' | 'card' | 'savings';

export interface Account {
  id: AccountId;
  name: string;
  detail: string;
}

export type TransactionStatus = 'cleared' | 'pending';

export interface Transaction {
  id: string;
  /** ISO calendar date, yyyy-mm-dd */
  date: string;
  description: string;
  counterparty: string;
  reference?: string;
  categoryId: CategoryId;
  accountId: AccountId;
  type: EntryType;
  /** Always positive; direction comes from `type`. */
  amountCents: number;
  status: TransactionStatus;
}

export type UpcomingKind = 'supplier-invoice' | 'recurring' | 'payout';

export interface UpcomingItem {
  id: string;
  dueDate: string;
  description: string;
  detail: string;
  categoryId: CategoryId;
  type: EntryType;
  amountCents: number;
  kind: UpcomingKind;
  /** Known exactly (an issued invoice, a fixed subscription) or estimated. */
  certainty: 'scheduled' | 'estimated';
}

export type PeriodUnit = 'month' | 'quarter' | 'year';

export interface Period {
  unit: PeriodUnit;
  /** 0 = the current period, -1 = the one before, … */
  offset: number;
}

export interface PeriodInfo {
  start: string;
  end: string;
  label: string;
  rangeLabel: string;
  comparisonLabel: string;
  isCurrent: boolean;
}

export interface Kpi {
  valueCents: number;
  previousCents: number;
  changeCents: number;
  /** Relative change vs. the comparison period, e.g. 0.12 for +12 %. Null when undefined. */
  changeRatio: number | null;
  /** Small trend series for the sparkline, oldest first. */
  trend: number[];
}

export interface MonthlyFlow {
  /** yyyy-mm */
  key: string;
  label: string;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  projected: boolean;
}

export interface CategoryShare {
  categoryId: CategoryId;
  name: string;
  cents: number;
  share: number;
}

export interface Insight {
  id: string;
  tone: 'neutral' | 'positive' | 'negative';
  lead: string;
  emphasis: string;
  trail: string;
  body: string;
  action: { label: string; to: string };
}

export interface BalancePoint {
  date: string;
  balanceCents: number;
  lowCents?: number;
  highCents?: number;
  projected: boolean;
}

export interface ScenarioSummary {
  id: string;
  name: string;
  description: string;
  assumptions: string[];
}

export interface ScenarioResult {
  scenario: ScenarioSummary;
  baseline: BalancePoint[];
  projection: BalancePoint[];
  baselineEndCents: number;
  scenarioEndCents: number;
  baselineLowCents: number;
  scenarioLowCents: number;
  scenarioLowDate: string;
  months: { key: string; label: string; baselineNetCents: number; scenarioNetCents: number }[];
}

export interface BudgetLine {
  categoryId: CategoryId;
  name: string;
  limitCents: number;
  spentCents: number;
  /** Spend expected by today if spending were spread evenly across the month. */
  paceCents: number;
  history: number[];
}

export interface BudgetMonth {
  key: string;
  label: string;
  isCurrent: boolean;
  daysLeft: number;
  elapsedRatio: number;
  lines: BudgetLine[];
  totalLimitCents: number;
  totalSpentCents: number;
}
