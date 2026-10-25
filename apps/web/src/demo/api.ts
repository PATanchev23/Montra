/*
 * Sample-data API
 * ───────────────
 * Async functions with the same responsibilities the REST endpoints will
 * have (filtering, aggregation, forecasting). Pages consume them through
 * TanStack Query hooks, so switching to the real API means replacing these
 * functions with `apiRequest` calls — components stay untouched.
 *
 * The financial maths lives here only until the backend endpoints exist.
 */
import {
  addDays,
  addMonths,
  addQuarters,
  addYears,
  differenceInCalendarDays,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
  getDaysInMonth,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfYear,
} from 'date-fns';
import {
  accounts,
  budgetLimits,
  business,
  categories,
  categoryById,
  DEMO_TODAY,
  DEMO_TODAY_ISO,
  futureEvents,
  historyStartIso,
  isIssuedInvoice,
  openingBalanceCents,
  transactions,
  type CashEvent,
} from './techstore';
import type {
  AccountId,
  BalancePoint,
  BudgetMonth,
  CategoryId,
  CategoryShare,
  EntryType,
  Insight,
  Kpi,
  MonthlyFlow,
  Period,
  PeriodInfo,
  ScenarioResult,
  ScenarioSummary,
  Transaction,
  UpcomingItem,
} from './types';

const LATENCY_MS = 180;
const wait = () => new Promise((resolve) => setTimeout(resolve, LATENCY_MS));

const iso = (date: Date) => format(date, 'yyyy-MM-dd');
const signed = (t: { type: EntryType; amountCents: number }) =>
  t.type === 'income' ? t.amountCents : -t.amountCents;

// ── Ledger helpers ───────────────────────────────────────────────────────

const chronological = [...transactions].reverse();

/** End-of-day balance for every day of the history. */
const dailyBalance = (() => {
  const map = new Map<string, number>();
  let balance = openingBalanceCents;
  let cursor = parseISO(historyStartIso);
  let index = 0;
  while (iso(cursor) <= DEMO_TODAY_ISO) {
    const day = iso(cursor);
    while (index < chronological.length && chronological[index]!.date === day) {
      balance += signed(chronological[index]!);
      index++;
    }
    map.set(day, balance);
    cursor = addDays(cursor, 1);
  }
  return map;
})();

function balanceAt(day: string): number {
  if (day < historyStartIso) return openingBalanceCents;
  return dailyBalance.get(day > DEMO_TODAY_ISO ? DEMO_TODAY_ISO : day) ?? openingBalanceCents;
}

function inRange(from: string, to: string) {
  return transactions.filter((t) => t.date >= from && t.date <= to);
}

function totals(list: Transaction[]) {
  let income = 0;
  let expense = 0;
  for (const t of list) {
    if (t.type === 'income') income += t.amountCents;
    else expense += t.amountCents;
  }
  return { income, expense, net: income - expense };
}

function ratio(current: number, previous: number) {
  return previous === 0 ? null : (current - previous) / Math.abs(previous);
}

/** Splits [from, to] into equal buckets and sums values per bucket. */
function bucketed(from: string, to: string, buckets: number, pick: (t: Transaction) => number) {
  const start = parseISO(from);
  const span = differenceInCalendarDays(parseISO(to), start) + 1;
  const values = new Array<number>(buckets).fill(0);
  for (const t of inRange(from, to)) {
    const i = Math.min(
      buckets - 1,
      Math.floor((differenceInCalendarDays(parseISO(t.date), start) / span) * buckets),
    );
    values[i]! += pick(t);
  }
  return values;
}

/** Running total — shows the pace of income or spending through a period. */
function cumulative(values: number[]) {
  let sum = 0;
  return values.map((v) => (sum += v));
}

// ── Periods ──────────────────────────────────────────────────────────────

const unitLabel = { month: 'month', quarter: 'quarter', year: 'year' } as const;

export function describePeriod(period: Period): PeriodInfo & { dataEnd: string } {
  const { unit, offset } = period;
  const [start, end] =
    unit === 'month'
      ? [startOfMonth(addMonths(DEMO_TODAY, offset)), endOfMonth(addMonths(DEMO_TODAY, offset))]
      : unit === 'quarter'
        ? [
            startOfQuarter(addQuarters(DEMO_TODAY, offset)),
            endOfQuarter(addQuarters(DEMO_TODAY, offset)),
          ]
        : [startOfYear(addYears(DEMO_TODAY, offset)), endOfYear(addYears(DEMO_TODAY, offset))];

  const label =
    unit === 'month'
      ? format(start, 'MMMM yyyy')
      : unit === 'quarter'
        ? `Q${Math.floor(start.getMonth() / 3) + 1} ${format(start, 'yyyy')}`
        : format(start, 'yyyy');

  const isCurrent = offset === 0;
  return {
    start: iso(start),
    end: iso(end),
    dataEnd: isCurrent ? DEMO_TODAY_ISO : iso(end),
    label,
    rangeLabel: `${format(start, 'd MMM yyyy')} – ${format(end, 'd MMM yyyy')}`,
    comparisonLabel: isCurrent ? `vs. last ${unitLabel[unit]}` : `vs. previous ${unitLabel[unit]}`,
    isCurrent,
  };
}

function comparisonWindow(period: Period) {
  const current = describePeriod(period);
  const previous = describePeriod({ ...period, offset: period.offset - 1 });
  const elapsed = differenceInCalendarDays(parseISO(current.dataEnd), parseISO(current.start));
  const end = iso(addDays(parseISO(previous.start), elapsed));
  return { start: previous.start, end: end < previous.end ? end : previous.end };
}

export function listPeriods(unit: Period['unit'], count = 6) {
  return Array.from({ length: count }, (_, i) => {
    const period = { unit, offset: -i };
    const info = describePeriod(period);
    return { period, label: info.label, rangeLabel: info.rangeLabel };
  });
}

// ── Dashboard ────────────────────────────────────────────────────────────

export interface DashboardData {
  period: PeriodInfo;
  kpis: { balance: Kpi; revenue: Kpi; expenses: Kpi };
  insights: Insight[];
  expenseBreakdown: { totalCents: number; items: CategoryShare[] };
  recent: Transaction[];
  upcoming: UpcomingItem[];
  scenarioPreview: {
    horizonLabel: string;
    baseline: { label: string; endCents: number; trend: number[] };
    scenario: { id: string; label: string; endCents: number; trend: number[] };
  };
}

function kpi(value: number, previous: number, trend: number[]): Kpi {
  return {
    valueCents: value,
    previousCents: previous,
    changeCents: value - previous,
    changeRatio: ratio(value, previous),
    trend,
  };
}

function categoryShares(list: Transaction[], type: EntryType, top = 4) {
  const sums = new Map<CategoryId, number>();
  for (const t of list) {
    if (t.type === type) sums.set(t.categoryId, (sums.get(t.categoryId) ?? 0) + t.amountCents);
  }
  const total = [...sums.values()].reduce((a, b) => a + b, 0);
  const sorted = [...sums.entries()].sort((a, b) => b[1] - a[1]);
  const items: CategoryShare[] = sorted.slice(0, top).map(([id, value]) => ({
    categoryId: id,
    name: categoryById[id].name,
    cents: value,
    share: total ? value / total : 0,
  }));
  const rest = sorted.slice(top).reduce((sum, [, value]) => sum + value, 0);
  if (rest > 0) {
    items.push({ categoryId: 'utilities', name: 'Other', cents: rest, share: rest / total });
  }
  return { totalCents: total, items };
}

export function upcomingItems(days: number): UpcomingItem[] {
  const until = iso(addDays(DEMO_TODAY, days));
  return futureEvents
    .filter((e) => e.date <= until)
    .filter(
      (e) =>
        isIssuedInvoice(e) ||
        e.kind === 'recurring' ||
        e.counterparty === 'Meta Platforms' ||
        e.categoryId === 'sales-marketplace',
    )
    .map((e, i) => toUpcoming(e, i));
}

function toUpcoming(e: CashEvent, i: number): UpcomingItem {
  return {
    id: `up_${e.date}_${i}`,
    dueDate: e.date,
    description: e.description,
    detail:
      e.kind === 'supplier-invoice'
        ? `${e.counterparty} · Inventory`
        : e.type === 'income'
          ? 'Expected payout'
          : e.kind === 'recurring'
            ? categoryById[e.categoryId].name
            : 'Campaign payment',
    categoryId: e.categoryId,
    type: e.type,
    amountCents: e.expectedCents,
    kind:
      e.kind === 'supplier-invoice'
        ? 'supplier-invoice'
        : e.type === 'income'
          ? 'payout'
          : 'recurring',
    certainty: e.fixed || isIssuedInvoice(e) ? 'scheduled' : 'estimated',
  };
}

const DISCRETIONARY: CategoryId[] = ['inventory', 'advertising', 'shipping'];

function buildInsights(period: Period): Insight[] {
  const current = describePeriod(period);
  const previous = comparisonWindow(period);
  const ads = (from: string, to: string) =>
    inRange(from, to)
      .filter((t) => t.categoryId === 'advertising')
      .reduce((s, t) => s + t.amountCents, 0);
  const adsNow = ads(current.start, current.dataEnd);
  const adsBefore = ads(previous.start, previous.end);
  const adsChange = ratio(adsNow, adsBefore) ?? 0;
  const unit = unitLabel[period.unit];

  const dueSoon = upcomingItems(14).filter((u) => u.kind === 'supplier-invoice');
  const dueTotal = dueSoon.reduce((s, u) => s + u.amountCents, 0);
  const lowest = projectBalance().reduce((min, p) => (p.balanceCents < min.balanceCents ? p : min));

  // Fixed costs (rent, payroll…) always land on budget; only discretionary spend is interesting.
  const budgets = budgetMonth(0);
  const tightest = budgets.lines
    .filter((l) => DISCRETIONARY.includes(l.categoryId))
    .sort((a, b) => b.spentCents / b.limitCents - a.spentCents / a.limitCents)[0]!;
  const used = tightest.spentCents / tightest.limitCents;

  return [
    {
      id: 'advertising',
      tone: adsChange > 0 ? 'negative' : 'positive',
      lead: 'Your advertising expenses are',
      emphasis: `${Math.round(Math.abs(adsChange) * 100)}% ${adsChange > 0 ? 'higher' : 'lower'}`,
      trail: `than last ${unit}.`,
      body: `You've spent ${euro(adsNow)} on ads so far, compared with ${euro(adsBefore)} at the same point last ${unit}.`,
      action: { label: 'View details', to: '/transactions?category=advertising' },
    },
    {
      id: 'supplier-due',
      tone: 'neutral',
      lead: 'Supplier invoices worth',
      emphasis: euro(dueTotal),
      trail: 'fall due in the next 14 days.',
      body: `Your balance is projected to bottom out at ${euro(lowest.balanceCents)} on ${format(parseISO(lowest.date), 'd MMM')}, comfortably above zero.`,
      action: { label: 'Open cash flow', to: '/cash-flow' },
    },
    {
      id: 'budget',
      tone: used > 1 ? 'negative' : 'neutral',
      lead: `${tightest.name} has used`,
      emphasis: `${Math.round(used * 100)}%`,
      trail: 'of its monthly budget.',
      body:
        used > 1
          ? `It is ${euro(tightest.spentCents - tightest.limitCents)} over the ${euro(tightest.limitCents)} limit with ${budgets.daysLeft} days left in ${budgets.label}.`
          : `${euro(tightest.limitCents - tightest.spentCents)} of the ${euro(tightest.limitCents)} limit remains, with ${budgets.daysLeft} days left in ${budgets.label}.`,
      action: { label: 'Review budgets', to: '/budgets' },
    },
  ];
}

function euro(cents: number) {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export async function getDashboard(period: Period): Promise<DashboardData> {
  await wait();
  const info = describePeriod(period);
  const previous = comparisonWindow(period);
  const now = totals(inRange(info.start, info.dataEnd));
  const before = totals(inRange(previous.start, previous.end));

  const buckets = 10;
  const span = differenceInCalendarDays(parseISO(info.dataEnd), parseISO(info.start));
  const balanceTrend = Array.from({ length: buckets }, (_, i) =>
    balanceAt(iso(addDays(parseISO(info.start), Math.round((span * (i + 1)) / buckets)))),
  );

  const scenario = scenarioPresets.find((p) => p.summary.id === 'hire-support')!;
  const baseline = projectBalance();
  const withScenario = projectBalance(scenario.rule);
  const weekly = (points: BalancePoint[]) =>
    points.filter((_, i) => i % 7 === 0).map((p) => p.balanceCents);

  return {
    period: info,
    kpis: {
      balance: kpi(balanceAt(info.dataEnd), balanceAt(previous.end), balanceTrend),
      revenue: kpi(
        now.income,
        before.income,
        cumulative(
          bucketed(info.start, info.dataEnd, buckets, (t) =>
            t.type === 'income' ? t.amountCents : 0,
          ),
        ),
      ),
      expenses: kpi(
        now.expense,
        before.expense,
        cumulative(
          bucketed(info.start, info.dataEnd, buckets, (t) =>
            t.type === 'expense' ? t.amountCents : 0,
          ),
        ),
      ),
    },
    insights: buildInsights(period),
    expenseBreakdown: categoryShares(inRange(info.start, info.dataEnd), 'expense'),
    recent: transactions.slice(0, 5),
    upcoming: upcomingItems(30).slice(0, 5),
    scenarioPreview: {
      horizonLabel: 'Balance in 90 days',
      baseline: {
        label: 'Current plan',
        endCents: baseline.at(-1)!.balanceCents,
        trend: weekly(baseline),
      },
      scenario: {
        id: scenario.summary.id,
        label: scenario.summary.name,
        endCents: withScenario.at(-1)!.balanceCents,
        trend: weekly(withScenario),
      },
    },
  };
}

// ── Monthly flows ────────────────────────────────────────────────────────

export type FlowRange = '6m' | '12m' | 'ytd';

function monthKeys(from: Date, count: number) {
  return Array.from({ length: count }, (_, i) => startOfMonth(addMonths(from, i)));
}

function historicalMonth(month: Date): MonthlyFlow {
  const t = totals(inRange(iso(month), iso(endOfMonth(month))));
  return {
    key: format(month, 'yyyy-MM'),
    label: format(month, 'MMM'),
    incomeCents: t.income,
    expenseCents: t.expense,
    netCents: t.net,
    projected: false,
  };
}

function projectedMonth(month: Date, rule?: ScenarioRule): MonthlyFlow {
  const from = iso(month);
  const to = iso(endOfMonth(month));
  let income = 0;
  let expense = 0;
  for (const e of applyRule(futureEvents, rule)) {
    if (e.date < from || e.date > to) continue;
    if (e.type === 'income') income += e.expectedCents;
    else expense += e.expectedCents;
  }
  return {
    key: format(month, 'yyyy-MM'),
    label: format(month, 'MMM'),
    incomeCents: income,
    expenseCents: expense,
    netCents: income - expense,
    projected: true,
  };
}

export async function getMonthlyFlows(range: FlowRange): Promise<MonthlyFlow[]> {
  await wait();
  const thisMonth = startOfMonth(DEMO_TODAY);
  const months =
    range === 'ytd'
      ? monthKeys(startOfYear(DEMO_TODAY), DEMO_TODAY.getMonth() + 1)
      : monthKeys(addMonths(thisMonth, range === '6m' ? -5 : -11), range === '6m' ? 6 : 12);
  return months.map(historicalMonth);
}

// ── Forecast & scenarios ─────────────────────────────────────────────────

export const FORECAST_DAYS = 90;
const LOW_BALANCE_THRESHOLD_CENTS = 500_000;

interface ScenarioRule {
  revenueFactor?: number;
  categoryFactors?: Partial<Record<CategoryId, number>>;
  extraMonthly?: { description: string; categoryId: CategoryId; euros: number; day: number }[];
  oneOff?: {
    date: string;
    description: string;
    categoryId: CategoryId;
    type: EntryType;
    euros: number;
  }[];
  revenueByMonth?: Record<string, number>;
}

function applyRule(list: CashEvent[], rule?: ScenarioRule): CashEvent[] {
  if (!rule) return list;
  const adjusted = list.map((e) => {
    let factor = 1;
    if (e.type === 'income') {
      factor *= rule.revenueFactor ?? 1;
      factor *= rule.revenueByMonth?.[e.date.slice(0, 7)] ?? 1;
    }
    factor *= rule.categoryFactors?.[e.categoryId] ?? 1;
    return factor === 1 ? e : { ...e, expectedCents: Math.round(e.expectedCents * factor) };
  });
  const extras: CashEvent[] = [];
  for (const extra of rule.extraMonthly ?? []) {
    for (let m = 1; m <= 5; m++) {
      const date = iso(new Date(DEMO_TODAY.getFullYear(), DEMO_TODAY.getMonth() + m, extra.day));
      extras.push(
        syntheticEvent(date, extra.description, extra.categoryId, 'expense', extra.euros),
      );
    }
  }
  for (const once of rule.oneOff ?? []) {
    extras.push(
      syntheticEvent(once.date, once.description, once.categoryId, once.type, once.euros),
    );
  }
  return [...adjusted, ...extras].sort((a, b) => a.date.localeCompare(b.date));
}

function syntheticEvent(
  date: string,
  description: string,
  categoryId: CategoryId,
  type: EntryType,
  euros: number,
): CashEvent {
  const cents = Math.round(euros * 100);
  return {
    date,
    description,
    counterparty: description,
    categoryId,
    accountId: 'main',
    type,
    actualCents: cents,
    expectedCents: cents,
    kind: 'recurring',
    fixed: true,
  };
}

/** Daily projected balance from today, with an uncertainty band that widens over time. */
function projectBalance(rule?: ScenarioRule, days = FORECAST_DAYS): BalancePoint[] {
  const events = applyRule(futureEvents, rule);
  const points: BalancePoint[] = [];
  let balance = balanceAt(DEMO_TODAY_ISO);
  let index = 0;
  for (let d = 0; d <= days; d++) {
    const day = iso(addDays(DEMO_TODAY, d));
    while (index < events.length && events[index]!.date <= day) {
      const e = events[index]!;
      balance += e.type === 'income' ? e.expectedCents : -e.expectedCents;
      index++;
    }
    const spread = Math.round(52_000 * Math.sqrt(d));
    points.push({
      date: day,
      balanceCents: balance,
      lowCents: balance - spread,
      highCents: balance + spread,
      projected: d > 0,
    });
  }
  return points;
}

interface ScenarioPreset {
  summary: ScenarioSummary;
  rule: ScenarioRule;
}

const nextMonthKey = format(addMonths(DEMO_TODAY, 1), 'yyyy-MM');

export const scenarioPresets: ScenarioPreset[] = [
  {
    summary: {
      id: 'ads-plus-20',
      name: 'Increase ad spend by 20%',
      description: 'Scale Meta and Google campaigns ahead of the holiday season.',
      assumptions: ['Advertising +20%', 'Revenue +3% from extra traffic', 'Margins unchanged'],
    },
    rule: {
      categoryFactors: { advertising: 1.2, inventory: 1.03, shipping: 1.03 },
      revenueFactor: 1.03,
    },
  },
  {
    summary: {
      id: 'hire-support',
      name: 'Hire a support agent',
      description: 'A full-time customer support hire starting next month.',
      assumptions: [
        '+€1,850 payroll per month',
        `Starts ${format(addMonths(DEMO_TODAY, 1), 'MMMM')}`,
      ],
    },
    rule: {
      extraMonthly: [
        { description: 'Support agent salary', categoryId: 'payroll', euros: 1850, day: 25 },
      ],
    },
  },
  {
    summary: {
      id: 'black-friday',
      name: 'Black Friday stock-up',
      description: 'Pre-order €8,500 of extra stock to capture more Black Friday demand.',
      assumptions: [
        'One-off inventory €8,500 on 3 Nov',
        `Revenue +18% in ${format(addMonths(DEMO_TODAY, 1), 'MMMM')}`,
      ],
    },
    rule: {
      oneOff: [
        {
          date: iso(new Date(DEMO_TODAY.getFullYear(), DEMO_TODAY.getMonth() + 1, 3)),
          description: 'Black Friday stock order',
          categoryId: 'inventory',
          type: 'expense',
          euros: 8500,
        },
      ],
      revenueByMonth: { [nextMonthKey]: 1.18 },
    },
  },
  {
    summary: {
      id: 'lose-marketplace',
      name: 'Lose the marketplace channel',
      description: 'What if the marketplace delists TechStore from next week?',
      assumptions: ['Marketplace revenue stops', 'Inventory purchases −20%'],
    },
    rule: { categoryFactors: { 'sales-marketplace': 0, inventory: 0.8 } },
  },
];

export async function listScenarios(): Promise<ScenarioSummary[]> {
  await wait();
  return scenarioPresets.map((p) => p.summary);
}

export async function getScenarioResult(id: string): Promise<ScenarioResult> {
  await wait();
  const preset = scenarioPresets.find((p) => p.summary.id === id);
  if (!preset) throw new Error(`Unknown scenario: ${id}`);
  const baseline = projectBalance();
  const projection = projectBalance(preset.rule).map(({ lowCents: _l, highCents: _h, ...p }) => p);
  const low = projection.reduce((min, p) => (p.balanceCents < min.balanceCents ? p : min));
  const months = monthKeys(addMonths(startOfMonth(DEMO_TODAY), 1), 3).map((m) => ({
    key: format(m, 'yyyy-MM'),
    label: format(m, 'MMMM'),
    baselineNetCents: projectedMonth(m).netCents,
    scenarioNetCents: projectedMonth(m, preset.rule).netCents,
  }));
  return {
    scenario: preset.summary,
    baseline: weeklySample(baseline),
    projection: weeklySample(projection),
    baselineEndCents: baseline.at(-1)!.balanceCents,
    scenarioEndCents: projection.at(-1)!.balanceCents,
    baselineLowCents: Math.min(...baseline.map((p) => p.balanceCents)),
    scenarioLowCents: low.balanceCents,
    scenarioLowDate: low.date,
    months,
  };
}

// ── Cash flow page ───────────────────────────────────────────────────────

export interface CashFlowData {
  months: MonthlyFlow[];
  balance: BalancePoint[];
  thresholdCents: number;
  stats: {
    openingCents: number;
    incomeCents: number;
    expenseCents: number;
    closingCents: number;
    projectedCents: number;
    lowestCents: number;
    lowestDate: string;
  };
  upcoming: (UpcomingItem & { balanceAfterCents: number })[];
}

export async function getCashFlow(): Promise<CashFlowData> {
  await wait();
  const thisMonth = startOfMonth(DEMO_TODAY);
  const history = monthKeys(addMonths(thisMonth, -11), 12).map(historicalMonth);
  const projected = monthKeys(addMonths(thisMonth, 1), 3).map((m) => projectedMonth(m));

  // Weekly samples keep the line readable; payout-day spikes would otherwise dominate.
  const past: BalancePoint[] = [];
  for (let week = 22; week >= 1; week--) {
    const day = iso(addDays(DEMO_TODAY, -7 * week));
    past.push({ date: day, balanceCents: balanceAt(day), projected: false });
  }
  const daily = projectBalance();
  const future = weeklySample(daily);
  const lowest = daily.reduce((min, p) => (p.balanceCents < min.balanceCents ? p : min));

  const windowStart = iso(addMonths(thisMonth, -11));
  const t = totals(inRange(windowStart, DEMO_TODAY_ISO));

  let running = balanceAt(DEMO_TODAY_ISO);
  const until = iso(addDays(DEMO_TODAY, 30));
  const upcoming = futureEvents
    .filter((e) => e.date <= until)
    .map((e, i) => {
      running += e.type === 'income' ? e.expectedCents : -e.expectedCents;
      return { ...toUpcoming(e, i), balanceAfterCents: running };
    });

  return {
    months: [...history, ...projected],
    balance: [...past, ...future],
    thresholdCents: LOW_BALANCE_THRESHOLD_CENTS,
    stats: {
      openingCents: balanceAt(iso(addDays(parseISO(windowStart), -1))),
      incomeCents: t.income,
      expenseCents: t.expense,
      closingCents: balanceAt(DEMO_TODAY_ISO),
      projectedCents: future.at(-1)!.balanceCents,
      lowestCents: lowest.balanceCents,
      lowestDate: lowest.date,
    },
    upcoming,
  };
}

// ── Transactions ─────────────────────────────────────────────────────────

export type DateRange = '30d' | 'month' | 'last-month' | '90d' | 'year' | 'all';

export interface TransactionQuery {
  q?: string;
  type?: EntryType | 'all';
  categories?: CategoryId[];
  account?: AccountId | 'all';
  range?: DateRange;
  sort?: 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';
  page?: number;
  pageSize?: number;
}

export interface TransactionPage {
  items: Transaction[];
  total: number;
  page: number;
  pageCount: number;
  totals: { incomeCents: number; expenseCents: number; netCents: number };
}

export function rangeBounds(range: DateRange): [string, string] {
  switch (range) {
    case '30d':
      return [iso(addDays(DEMO_TODAY, -29)), DEMO_TODAY_ISO];
    case '90d':
      return [iso(addDays(DEMO_TODAY, -89)), DEMO_TODAY_ISO];
    case 'month':
      return [iso(startOfMonth(DEMO_TODAY)), DEMO_TODAY_ISO];
    case 'last-month': {
      const last = addMonths(DEMO_TODAY, -1);
      return [iso(startOfMonth(last)), iso(endOfMonth(last))];
    }
    case 'year':
      return [iso(startOfYear(DEMO_TODAY)), DEMO_TODAY_ISO];
    case 'all':
      return [historyStartIso, DEMO_TODAY_ISO];
  }
}

export async function listTransactions(query: TransactionQuery): Promise<TransactionPage> {
  await wait();
  const { q = '', type = 'all', categories: cats = [], account = 'all', range = '90d' } = query;
  const { sort = 'date-desc', page = 1, pageSize = 25 } = query;
  const [from, to] = rangeBounds(range);
  const needle = q.trim().toLowerCase();

  const filtered = transactions.filter(
    (t) =>
      t.date >= from &&
      t.date <= to &&
      (type === 'all' || t.type === type) &&
      (cats.length === 0 || cats.includes(t.categoryId)) &&
      (account === 'all' || t.accountId === account) &&
      (!needle ||
        t.description.toLowerCase().includes(needle) ||
        t.counterparty.toLowerCase().includes(needle) ||
        categoryById[t.categoryId].name.toLowerCase().includes(needle)),
  );

  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case 'date-asc':
        return a.date.localeCompare(b.date);
      case 'amount-desc':
        return b.amountCents - a.amountCents;
      case 'amount-asc':
        return a.amountCents - b.amountCents;
      default:
        return b.date.localeCompare(a.date);
    }
  });

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  const t = totals(filtered);
  return {
    items: sorted.slice((current - 1) * pageSize, current * pageSize),
    total: filtered.length,
    page: current,
    pageCount,
    totals: { incomeCents: t.income, expenseCents: t.expense, netCents: t.net },
  };
}

/** Every matching row, for CSV export. */
export async function exportTransactions(query: TransactionQuery) {
  const result = await listTransactions({ ...query, page: 1, pageSize: Number.MAX_SAFE_INTEGER });
  return result.items;
}

// ── Budgets ──────────────────────────────────────────────────────────────

function budgetMonth(offset: number): BudgetMonth {
  const month = startOfMonth(addMonths(DEMO_TODAY, offset));
  const isCurrent = offset === 0;
  const end = isCurrent ? DEMO_TODAY_ISO : iso(endOfMonth(month));
  const days = getDaysInMonth(month);
  const elapsedRatio = isCurrent ? DEMO_TODAY.getDate() / days : 1;
  const spentIn = (m: Date, categoryId: CategoryId, until?: string) =>
    inRange(iso(m), until ?? iso(endOfMonth(m)))
      .filter((t) => t.categoryId === categoryId)
      .reduce((s, t) => s + t.amountCents, 0);

  const lines = (Object.entries(budgetLimits) as [CategoryId, number][]).map(([id, limit]) => ({
    categoryId: id,
    name: categoryById[id].name,
    limitCents: limit,
    spentCents: spentIn(month, id, end),
    paceCents: Math.round(limit * elapsedRatio),
    history: monthKeys(addMonths(month, -5), 6).map((m) =>
      spentIn(m, id, iso(m) === iso(month) ? end : undefined),
    ),
  }));

  return {
    key: format(month, 'yyyy-MM'),
    label: format(month, 'MMMM'),
    isCurrent,
    daysLeft: isCurrent ? days - DEMO_TODAY.getDate() : 0,
    elapsedRatio,
    lines,
    totalLimitCents: lines.reduce((s, l) => s + l.limitCents, 0),
    totalSpentCents: lines.reduce((s, l) => s + l.spentCents, 0),
  };
}

export async function getBudgets(offset: number): Promise<BudgetMonth> {
  await wait();
  return budgetMonth(offset);
}

// ── Reports ──────────────────────────────────────────────────────────────

export interface ReportData {
  year: number;
  asOf: string;
  summary: { revenueCents: number; expenseCents: number; netCents: number; margin: number };
  quarters: string[];
  rows: {
    categoryId: CategoryId;
    name: string;
    type: EntryType;
    quarters: number[];
    total: number;
  }[];
  monthlyNet: MonthlyFlow[];
  channels: CategoryShare[];
}

export async function getReport(year: number): Promise<ReportData> {
  await wait();
  const from = `${year}-01-01`;
  const to = `${year}-12-31` < DEMO_TODAY_ISO ? `${year}-12-31` : DEMO_TODAY_ISO;
  const yearTx = inRange(from, to);
  const rows = categories
    .map((c) => {
      const quarters = [0, 1, 2, 3].map((q) =>
        yearTx
          .filter(
            (t) => t.categoryId === c.id && Math.floor((Number(t.date.slice(5, 7)) - 1) / 3) === q,
          )
          .reduce((s, t) => s + t.amountCents, 0),
      );
      return {
        categoryId: c.id,
        name: c.name,
        type: c.type,
        quarters,
        total: quarters.reduce((a, b) => a + b, 0),
      };
    })
    .filter((r) => r.total > 0);
  const t = totals(yearTx);
  const months = monthKeys(new Date(year, 0, 1), 12).map((m) =>
    iso(m) <= DEMO_TODAY_ISO ? historicalMonth(m) : projectedMonth(m),
  );
  return {
    year,
    asOf: to,
    summary: {
      revenueCents: t.income,
      expenseCents: t.expense,
      netCents: t.net,
      margin: t.income ? t.net / t.income : 0,
    },
    quarters: ['Q1', 'Q2', 'Q3', 'Q4'],
    rows,
    monthlyNet: months,
    channels: categoryShares(yearTx, 'income', 3).items,
  };
}

// ── Shell ────────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  title: string;
  body: string;
  time: string;
  tone: 'neutral' | 'warning' | 'negative';
  to: string;
}

export async function getNotifications(): Promise<Notification[]> {
  await wait();
  const due = upcomingItems(3).find((u) => u.kind === 'supplier-invoice');
  const budget = budgetMonth(0).lines.find((l) => l.spentCents > l.limitCents);
  const list: Notification[] = [];
  if (due) {
    list.push({
      id: 'due',
      title: `${due.description} is due ${format(parseISO(due.dueDate), 'EEEE')}`,
      body: `${euro(due.amountCents)} to ${due.detail.split(' · ')[0]}`,
      time: 'Today',
      tone: 'warning',
      to: '/cash-flow',
    });
  }
  if (budget) {
    list.push({
      id: 'budget',
      title: `${budget.name} is over budget`,
      body: `${euro(budget.spentCents)} spent of ${euro(budget.limitCents)}`,
      time: 'Yesterday',
      tone: 'negative',
      to: '/budgets',
    });
  }
  list.push({
    id: 'payout',
    title: 'Marketplace payout received',
    body: 'Weekly settlement cleared to the main account',
    time: '2 days ago',
    tone: 'neutral',
    to: '/transactions?category=sales-marketplace',
  });
  return list;
}

export { accounts, business, categories, DEMO_TODAY, DEMO_TODAY_ISO };

/** Every seventh day plus the final day — enough resolution for a 90-day chart. */
function weeklySample<T>(points: T[]): T[] {
  return points.filter((_, i) => i % 7 === 0 || i === points.length - 1);
}
