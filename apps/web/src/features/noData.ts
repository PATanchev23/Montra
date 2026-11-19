import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  getDaysInMonth,
  startOfMonth,
  startOfYear,
} from 'date-fns';
import type { CashFlowData, ReportData } from '../demo/api';
import type { BalancePoint, BudgetMonth, MonthlyFlow, ScenarioResult } from '../demo/types';
import { formatDay } from '../lib/format';

/*
 * All-zero stand-ins for the pages that still run on the TechStore sample
 * layer, for a business with no transactions of its own. The pages draw them
 * with their usual components, so the layout is the one the business will
 * see once data arrives, only empty: €0, no rows, no invented figures. Dates
 * follow the real calendar, not the sample's 25 October.
 */

const iso = (date: Date) => format(date, 'yyyy-MM-dd');
const monthKey = (date: Date) => format(date, 'yyyy-MM');

function zeroMonth(month: Date): MonthlyFlow {
  return {
    key: monthKey(month),
    label: formatDay(month, 'LLL'),
    incomeCents: 0,
    expenseCents: 0,
    netCents: 0,
    projected: false,
  };
}

/** Weekly zero balances over `weeks` weeks ending on `today`. */
function zeroBalance(today: Date, weeks: number): BalancePoint[] {
  return Array.from({ length: weeks + 1 }, (_, i) => ({
    date: iso(addDays(today, -7 * (weeks - i))),
    balanceCents: 0,
    projected: false,
  }));
}

/** Twelve months to this one, all zero, with nothing projected. */
export function emptyCashFlow(today = new Date()): CashFlowData {
  const thisMonth = startOfMonth(today);
  return {
    months: Array.from({ length: 12 }, (_, i) => zeroMonth(addMonths(thisMonth, i - 11))),
    balance: zeroBalance(today, 22),
    thresholdCents: 0,
    stats: {
      openingCents: 0,
      incomeCents: 0,
      expenseCents: 0,
      closingCents: 0,
      projectedCents: 0,
      lowestCents: 0,
      lowestDate: iso(today),
    },
    upcoming: [],
  };
}

/** A month with no budgets set and nothing spent; `offset` counts months back from this one. */
export function emptyBudgetMonth(offset: number, today = new Date()): BudgetMonth {
  const month = startOfMonth(addMonths(today, offset));
  const isCurrent = offset === 0;
  const days = getDaysInMonth(month);
  return {
    key: monthKey(month),
    label: formatDay(month, 'LLLL'),
    isCurrent,
    daysLeft: isCurrent ? days - today.getDate() : 0,
    elapsedRatio: isCurrent ? today.getDate() / days : 1,
    lines: [],
    totalLimitCents: 0,
    totalSpentCents: 0,
  };
}

/** A plan with nothing in it: flat at zero for the next 90 days, and the next three months at zero. */
export function emptyScenarioResult(name: string, today = new Date()): ScenarioResult {
  const flat = Array.from({ length: 14 }, (_, i) => ({
    date: iso(addDays(today, 7 * i)),
    balanceCents: 0,
    projected: true,
  }));
  return {
    scenario: { id: '', name, description: '', assumptions: [] },
    baseline: flat,
    projection: flat,
    baselineEndCents: 0,
    scenarioEndCents: 0,
    baselineLowCents: 0,
    scenarioLowCents: 0,
    scenarioLowDate: iso(today),
    months: [1, 2, 3].map((i) => {
      const month = startOfMonth(addMonths(today, i));
      return {
        key: monthKey(month),
        label: formatDay(month, 'LLLL yyyy'),
        baselineNetCents: 0,
        scenarioNetCents: 0,
      };
    }),
  };
}

/** A year with no revenue, expenses or channels. */
export function emptyReport(year: number, today = new Date()): ReportData {
  const first = startOfYear(new Date(year, 0, 1));
  const asOf = year === today.getFullYear() ? today : endOfMonth(addMonths(first, 11));
  return {
    year,
    asOf: iso(asOf),
    summary: { revenueCents: 0, expenseCents: 0, netCents: 0, margin: 0 },
    quarters: ['Q1', 'Q2', 'Q3', 'Q4'],
    rows: [],
    monthlyNet: Array.from({ length: 12 }, (_, i) => zeroMonth(addMonths(first, i))),
    channels: [],
  };
}
