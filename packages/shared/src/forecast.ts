import {
  isoAddDays,
  isoDaysBetween,
  isoEndOfMonth,
  isoShiftMonth,
  isoStartOfMonth,
} from './dashboard';
import {
  FORECAST_DAYS,
  SCENARIO_PRESET_IDS,
  UPCOMING_DAYS,
  type Alert,
  type BalancePoint,
  type BudgetGoal,
  type BudgetMonthResponse,
  type BudgetRecommendation,
  type CashSettings,
  type MonthlyFlow,
  type ReportResponse,
  type ScenarioPreset,
  type ScenarioPresetsResponse,
  type ScenarioRule,
  type SimulationResponse,
  type UpcomingPayment,
} from './finance';
import { INDUSTRY_PEAK_MONTHS, industryKind } from './industry';
import type { TransactionType } from './transactions';

/*
 * Montra's forecasting engine. Pure functions over a business's ledger, so
 * the API (with rows from the database) and the web tests (with rows in
 * memory) compute exactly the same figures.
 *
 * The forecast has three parts, each traceable to the ledger:
 *
 *  1. Recurring payments: a description that appears once a month in at
 *     least three of the last six full months, and was still paid last
 *     month or this one (rent, salaries, subscriptions). Each is projected on
 *     its usual day at the median of its last three amounts.
 *  2. Transactions dated after today: already known, so projected as they are.
 *  3. Everything else: spread evenly over the coming days at the daily rate
 *     of the last 90 days, per category.
 *
 * The likely range around the projected balance widens with the square root
 * of time, scaled by how much the non-recurring weekly net has varied.
 *
 * The bank balance comes from the owner (cash settings); without it the
 * ledger starts from zero, so balances show the change rather than the cash.
 */

export interface LedgerEntry {
  date: string;
  type: TransactionType;
  amountCents: number;
  category: string;
  description: string;
}

export interface BudgetLimit {
  category: string;
  limitCents: number;
}

/** Categories match whatever their case or surrounding spaces, as the dashboard does. */
export const categoryKey = (category: string) => category.trim().toLocaleLowerCase('en');

const VARIABLE_WINDOW_DAYS = 90;
/** A short history is spread over at least four weeks, so a week's sales are not read as a month's. */
const MIN_VARIABLE_SPAN_DAYS = 28;
const RECURRING_LOOKBACK_MONTHS = 6;
const RECURRING_MIN_MONTHS = 3;
const FIXED_SHARE = 0.8;
/** How far a recurring amount may move and still be a commitment. */
const STEADY_SPREAD = 0.1;
const HISTORY_MONTHS = 12;
const PAST_WEEKS = 22;

const signed = (e: { type: TransactionType; amountCents: number }) =>
  e.type === 'INCOME' ? e.amountCents : -e.amountCents;

const month = (date: string) => date.slice(0, 7);

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

// \b only knows Latin letters, so the word edges are spelled out to cover Cyrillic too.
const MONTH_NAMES =
  /(?<!\p{L})(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?|януари|февруари|март|април|май|юни|юли|август|септември|октомври|ноември|декември)(?!\p{L})/gu;

/** "Rent — October 2026" and "Rent – November 2026" are the same payment. */
export function seriesKey(description: string): string {
  return description
    .toLocaleLowerCase('en')
    .replace(/\p{N}+/gu, ' ')
    .replace(MONTH_NAMES, ' ')
    .replace(/[^\p{L}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface Series {
  type: TransactionType;
  description: string;
  category: string;
  amountCents: number;
  /** Usual day of the month. */
  day: number;
  /** Every recent amount was the same. */
  fixed: boolean;
  /** Every recent amount was within 10% of the usual one: a commitment, not a choice. */
  steady: boolean;
  paidThisMonth: boolean;
}

interface Flow {
  date: string;
  type: TransactionType;
  category: string;
  description: string;
  amountCents: number;
  certainty: 'scheduled' | 'estimated';
}

interface DayProjection {
  date: string;
  incomeCents: number;
  expenseCents: number;
  /** Unrounded: the daily rates are fractions of a cent. */
  balance: number;
}

/** Everything the engine works out once per ledger, for any number of questions. */
export class Ledger {
  readonly today: string;
  readonly settings: CashSettings;
  /** Entries up to and including today, oldest first. */
  private readonly past: LedgerEntry[];
  /** Entries dated after today: known future payments. */
  private readonly future: LedgerEntry[];
  private readonly cumulative: number[];
  readonly openingCents: number;
  private readonly names = new Map<string, Map<string, number>>();
  private series: Series[] | null = null;
  private recurringIndexes = new Set<number>();
  private rates: { type: TransactionType; key: string; perDay: number }[] | null = null;
  private weeklySpread = 0;

  constructor(entries: LedgerEntry[], today: string, settings: CashSettings) {
    this.today = today;
    this.settings = settings;
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    this.past = sorted.filter((e) => e.date <= today);
    this.future = sorted.filter((e) => e.date > today);
    let sum = 0;
    this.cumulative = this.past.map((e) => (sum += signed(e)));
    for (const e of sorted) {
      const key = categoryKey(e.category);
      const spellings = this.names.get(key) ?? new Map<string, number>();
      spellings.set(e.category, (spellings.get(e.category) ?? 0) + 1);
      this.names.set(key, spellings);
    }
    // The owner's balance on a day fixes where the ledger starts.
    this.openingCents =
      settings.balanceCents !== null && settings.balanceDate !== null
        ? settings.balanceCents - this.netUpTo(settings.balanceDate)
        : 0;
  }

  get transactionCount(): number {
    return this.past.length + this.future.length;
  }

  /** The most used spelling of a category. */
  displayName(key: string): string {
    const spellings = this.names.get(key);
    if (!spellings) return key;
    return [...spellings.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0];
  }

  private netUpTo(day: string): number {
    let lo = 0;
    let hi = this.past.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.past[mid]!.date <= day) {
        found = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return found < 0 ? 0 : this.cumulative[found]!;
  }

  /** The first transaction's date, if there is one. */
  get firstDate(): string | null {
    return this.past[0]?.date ?? this.future[0]?.date ?? null;
  }

  /** The balance at the end of a day up to today. */
  balanceAt(day: string): number {
    return this.openingCents + this.netUpTo(day > this.today ? this.today : day);
  }

  /** Income and expenses between two dates, inclusive (past entries only). */
  totals(from: string, to: string, filter?: (e: LedgerEntry) => boolean) {
    let income = 0;
    let expense = 0;
    for (const e of this.past) {
      if (e.date < from || e.date > to || (filter && !filter(e))) continue;
      if (e.type === 'INCOME') income += e.amountCents;
      else expense += e.amountCents;
    }
    return { income, expense, net: income - expense };
  }

  entriesBetween(from: string, to: string): LedgerEntry[] {
    return this.past.filter((e) => e.date >= from && e.date <= to);
  }

  /** Payments that repeat every month; see the header comment. */
  recurring(): Series[] {
    if (this.series) return this.series;
    const thisMonth = isoStartOfMonth(this.today);
    const lastMonth = month(isoShiftMonth(this.today, -1));
    const from = isoShiftMonth(this.today, -RECURRING_LOOKBACK_MONTHS);
    const groups = new Map<string, number[]>();
    this.past.forEach((e, i) => {
      if (e.date < from) return;
      const key = `${e.type}|${seriesKey(e.description) || categoryKey(e.category)}`;
      groups.set(key, [...(groups.get(key) ?? []), i]);
    });

    const series: Series[] = [];
    for (const [key, indexes] of groups) {
      const entries = indexes.map((i) => this.past[i]!);
      const full = entries.filter((e) => e.date < thisMonth);
      const months = new Set(full.map((e) => month(e.date)));
      if (months.size < RECURRING_MIN_MONTHS) continue;
      // Monthly, not weekly: at most one extra payment across the whole window.
      if (full.length > months.size + 1) continue;
      const still = entries.some((e) => month(e.date) === lastMonth || e.date >= thisMonth);
      if (!still) continue;

      const recent = [...entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
      const amounts = recent.map((e) => e.amountCents);
      series.push({
        type: key.startsWith('INCOME') ? 'INCOME' : 'EXPENSE',
        description: recent[0]!.description,
        category: recent[0]!.category,
        amountCents: median(amounts),
        day: median(recent.map((e) => Number(e.date.slice(8, 10)))),
        fixed: amounts.every((a) => a === amounts[0]),
        steady: amounts.every(
          (a) => Math.abs(a - median(amounts)) <= median(amounts) * STEADY_SPREAD,
        ),
        paidThisMonth: entries.some((e) => e.date >= thisMonth),
      });
      indexes.forEach((i) => this.recurringIndexes.add(i));
    }
    this.series = series;
    return series;
  }

  /** Daily rates of everything that does not repeat, per category, from the last 90 days. */
  private variableRates() {
    if (this.rates) return this.rates;
    this.recurring();
    const first = this.past[0]?.date ?? this.today;
    const windowStart = isoAddDays(this.today, -(VARIABLE_WINDOW_DAYS - 1));
    const from = first > windowStart ? first : windowStart;
    const span = Math.max(isoDaysBetween(from, this.today) + 1, MIN_VARIABLE_SPAN_DAYS);

    const sums = new Map<string, { type: TransactionType; key: string; cents: number }>();
    const weeks = new Array<number>(Math.max(1, Math.floor(span / 7))).fill(0);
    this.past.forEach((e, i) => {
      if (e.date < from || this.recurringIndexes.has(i)) return;
      const key = categoryKey(e.category);
      const id = `${e.type}|${key}`;
      const entry = sums.get(id) ?? { type: e.type, key, cents: 0 };
      entry.cents += e.amountCents;
      sums.set(id, entry);
      const week = Math.min(weeks.length - 1, Math.floor(isoDaysBetween(from, e.date) / 7));
      weeks[week]! += signed(e);
    });
    this.rates = [...sums.values()].map(({ type, key, cents }) => ({
      type,
      key,
      perDay: cents / span,
    }));
    const mean = weeks.reduce((a, b) => a + b, 0) / weeks.length;
    this.weeklySpread = Math.sqrt(weeks.reduce((s, w) => s + (w - mean) ** 2, 0) / weeks.length);
    return this.rates;
  }

  /** Recurring payments and future-dated entries from tomorrow to `days` ahead, soonest first. */
  scheduledFlows(days: number): Flow[] {
    const end = isoAddDays(this.today, days);
    const flows: Flow[] = this.future
      .filter((e) => e.date <= end)
      .map((e) => ({ ...e, certainty: 'scheduled' as const }));
    for (const s of this.recurring()) {
      for (let m = 0; ; m++) {
        const start = isoShiftMonth(this.today, m);
        if (start > end) break;
        if (m === 0 && s.paidThisMonth) continue;
        const last = Number(isoEndOfMonth(start).slice(8, 10));
        const date = `${start.slice(0, 8)}${String(Math.min(s.day, last)).padStart(2, '0')}`;
        if (date <= this.today || date > end) continue;
        flows.push({
          date,
          type: s.type,
          category: s.category,
          description: s.description,
          amountCents: s.amountCents,
          certainty: s.fixed ? 'scheduled' : 'estimated',
        });
      }
    }
    return flows.sort((a, b) => a.date.localeCompare(b.date) || b.amountCents - a.amountCents);
  }

  /** The balance day by day from today (index 0) to `days` ahead, with an optional what-if. */
  project(days: number, rule: ScenarioRule = {}): DayProjection[] {
    const rates = this.variableRates();
    const ruleKey = rule.category === undefined ? null : categoryKey(rule.category);
    const factor = (type: TransactionType, key: string) =>
      (1 + ((type === 'INCOME' ? rule.incomeChangePct : rule.expenseChangePct) ?? 0) / 100) *
      (key === ruleKey ? 1 + (rule.categoryChangePct ?? 0) / 100 : 1);

    let dailyIncome = 0;
    let dailyExpense = 0;
    for (const r of rates) {
      const cents = r.perDay * factor(r.type, r.key);
      if (r.type === 'INCOME') dailyIncome += cents;
      else dailyExpense += cents;
    }

    const byDate = new Map<string, { income: number; expense: number }>();
    const add = (date: string, type: TransactionType, cents: number) => {
      const day = byDate.get(date) ?? { income: 0, expense: 0 };
      if (type === 'INCOME') day.income += cents;
      else day.expense += cents;
      byDate.set(date, day);
    };
    for (const f of this.scheduledFlows(days)) {
      add(f.date, f.type, f.amountCents * factor(f.type, categoryKey(f.category)));
    }
    if (rule.monthlyCostCents !== undefined) {
      for (let m = 1; ; m++) {
        const date = isoShiftMonth(this.today, m);
        if (isoDaysBetween(this.today, date) > days) break;
        add(date, 'EXPENSE', rule.monthlyCostCents);
      }
    }
    if (rule.oneOffType && rule.oneOffCents !== undefined && rule.oneOffDate) {
      if (rule.oneOffDate > this.today) add(rule.oneOffDate, rule.oneOffType, rule.oneOffCents);
    }

    let balance = this.balanceAt(this.today);
    const points: DayProjection[] = [
      { date: this.today, incomeCents: 0, expenseCents: 0, balance },
    ];
    for (let d = 1; d <= days; d++) {
      const date = isoAddDays(this.today, d);
      const extra = byDate.get(date);
      const income = dailyIncome + (extra?.income ?? 0);
      const expense = dailyExpense + (extra?.expense ?? 0);
      balance += income - expense;
      points.push({ date, incomeCents: income, expenseCents: expense, balance });
    }
    return points;
  }

  /** Half the likely range of the balance `days` ahead. */
  spreadAt(days: number): number {
    this.variableRates();
    return Math.round(this.weeklySpread * Math.sqrt(days / 7));
  }
}

// ── Shared pieces ───────────────────────────────────────────────────────

function historicalMonth(ledger: Ledger, start: string): MonthlyFlow {
  const end = isoEndOfMonth(start);
  const t = ledger.totals(start, end < ledger.today ? end : ledger.today);
  return {
    month: month(start),
    incomeCents: t.income,
    expenseCents: t.expense,
    netCents: t.net,
    projected: false,
  };
}

function projectedMonths(days: DayProjection[], months: string[]): MonthlyFlow[] {
  return months.map((m) => {
    let income = 0;
    let expense = 0;
    for (const d of days) {
      if (month(d.date) !== m || d === days[0]) continue;
      income += d.incomeCents;
      expense += d.expenseCents;
    }
    const incomeCents = Math.round(income);
    const expenseCents = Math.round(expense);
    return {
      month: m,
      incomeCents,
      expenseCents,
      netCents: incomeCents - expenseCents,
      projected: true,
    };
  });
}

/** Every seventh day from today, and the last: enough resolution for a 90-day chart. */
function weekly(days: DayProjection[], ledger: Ledger, withRange: boolean): BalancePoint[] {
  return days
    .map((d, i) => ({ d, i }))
    .filter(({ i }) => i % 7 === 0 || i === days.length - 1)
    .map(({ d, i }) => {
      const balanceCents = Math.round(d.balance);
      const spread = ledger.spreadAt(i);
      return {
        date: d.date,
        balanceCents,
        ...(withRange &&
          i > 0 && { lowCents: balanceCents - spread, highCents: balanceCents + spread }),
        projected: i > 0,
      };
    });
}

function lowest(days: DayProjection[]) {
  return days.reduce((min, d) => (d.balance < min.balance ? d : min));
}

// ── Cash flow ───────────────────────────────────────────────────────────

export function buildCashFlow(ledger: Ledger) {
  const { today } = ledger;
  const windowStart = isoShiftMonth(today, -(HISTORY_MONTHS - 1));
  const history = Array.from({ length: HISTORY_MONTHS }, (_, i) =>
    historicalMonth(ledger, isoShiftMonth(today, i - (HISTORY_MONTHS - 1))),
  );
  const horizonEnd = isoEndOfMonth(isoShiftMonth(today, 3));
  const days = ledger.project(Math.max(FORECAST_DAYS, isoDaysBetween(today, horizonEnd)));
  const forecast = days.slice(0, FORECAST_DAYS + 1);
  const projected = projectedMonths(
    days,
    [1, 2, 3].map((m) => month(isoShiftMonth(today, m))),
  );

  const past: BalancePoint[] = [];
  for (let week = PAST_WEEKS; week >= 1; week--) {
    const date = isoAddDays(today, -7 * week);
    past.push({ date, balanceCents: ledger.balanceAt(date), projected: false });
  }
  const balanceByDate = new Map(days.map((d) => [d.date, Math.round(d.balance)]));
  const upcoming: UpcomingPayment[] = ledger.scheduledFlows(UPCOMING_DAYS).map((f, i) => ({
    id: `${f.date}-${i}`,
    dueDate: f.date,
    description: f.description,
    category: f.category,
    type: f.type,
    amountCents: f.amountCents,
    certainty: f.certainty,
    balanceAfterCents: balanceByDate.get(f.date) ?? Math.round(days.at(-1)!.balance),
  }));

  const t = ledger.totals(windowStart, today);
  const low = lowest(forecast);
  // Where the figures start: a year back, or just before the records when they are younger.
  const beforeWindow = isoAddDays(windowStart, -1);
  const beforeRecords = ledger.firstDate === null ? null : isoAddDays(ledger.firstDate, -1);
  const openingDate =
    beforeRecords !== null && beforeRecords > beforeWindow ? beforeRecords : beforeWindow;
  return {
    today,
    settings: ledger.settings,
    transactionCount: ledger.transactionCount,
    months: [...history, ...projected],
    balance: [...past, ...weekly(forecast, ledger, true)],
    stats: {
      openingDate,
      openingCents: ledger.balanceAt(openingDate),
      incomeCents: t.income,
      expenseCents: t.expense,
      closingCents: ledger.balanceAt(today),
      projectedCents: Math.round(forecast.at(-1)!.balance),
      lowestCents: Math.round(low.balance),
      lowestDate: low.date,
    },
    ledgerStart:
      ledger.firstDate === null ? null : { date: ledger.firstDate, cents: ledger.openingCents },
    upcoming,
  };
}

// ── Budgets ─────────────────────────────────────────────────────────────

function averageMonthlyByCategory(ledger: Ledger, type: TransactionType) {
  const from = isoShiftMonth(ledger.today, -3);
  const to = isoAddDays(isoStartOfMonth(ledger.today), -1);
  const sums = new Map<string, number>();
  for (const e of ledger.entriesBetween(from, to)) {
    if (e.type !== type) continue;
    const key = categoryKey(e.category);
    sums.set(key, (sums.get(key) ?? 0) + e.amountCents);
  }
  return new Map([...sums].map(([key, cents]) => [key, Math.round(cents / 3)]));
}

/** `monthKey` is yyyy-mm, no later than today's month. */
export function buildBudgetMonth(ledger: Ledger, limits: BudgetLimit[], monthKey: string) {
  const { today } = ledger;
  const start = `${monthKey}-01`;
  const end = isoEndOfMonth(start);
  const isCurrent = monthKey === month(today);
  const daysInMonth = Number(end.slice(8, 10));
  const daysElapsed = isCurrent ? Number(today.slice(8, 10)) : daysInMonth;
  const spent = (key: string, from: string, to: string) =>
    ledger.totals(from, to, (e) => e.type === 'EXPENSE' && categoryKey(e.category) === key).expense;

  const averages = averageMonthlyByCategory(ledger, 'EXPENSE');
  const recurringByCategory = new Map<string, number>();
  for (const s of ledger.recurring()) {
    if (s.type !== 'EXPENSE') continue;
    const key = categoryKey(s.category);
    recurringByCategory.set(key, (recurringByCategory.get(key) ?? 0) + s.amountCents);
  }

  const lines = limits.map(({ category, limitCents }) => {
    const key = categoryKey(category);
    const average = averages.get(key) ?? 0;
    return {
      category,
      limitCents,
      spentCents: spent(key, start, isCurrent ? today : end),
      paceCents: Math.round((limitCents * daysElapsed) / daysInMonth),
      history: [-5, -4, -3, -2, -1, 0].map((offset) => {
        const from = isoShiftMonth(start, offset);
        const to = isoEndOfMonth(from);
        return spent(key, from, to < today ? to : today);
      }),
      fixed: average > 0 && (recurringByCategory.get(key) ?? 0) >= average * FIXED_SHARE,
    };
  });

  const budgeted = new Map(limits.map((l) => [categoryKey(l.category), l]));
  const yearAgo = isoShiftMonth(today, -(HISTORY_MONTHS - 1));
  const used = new Set(
    ledger
      .entriesBetween(yearAgo, today)
      .filter((e) => e.type === 'EXPENSE')
      .map((e) => categoryKey(e.category)),
  );
  const categories = [...new Set([...budgeted.keys(), ...used])]
    .map((key) => ({
      category: budgeted.get(key)?.category ?? ledger.displayName(key),
      limitCents: budgeted.get(key)?.limitCents ?? null,
      averageCents: averages.get(key) ?? 0,
    }))
    .sort((a, b) => b.averageCents - a.averageCents || a.category.localeCompare(b.category));

  return {
    today,
    month: monthKey,
    isCurrent,
    daysInMonth,
    daysElapsed,
    lines,
    totalLimitCents: lines.reduce((s, l) => s + l.limitCents, 0),
    totalSpentCents: lines.reduce((s, l) => s + l.spentCents, 0),
    latestExpenseMonth:
      ledger
        .entriesBetween('0000-01-01', today)
        .findLast((e) => e.type === 'EXPENSE')
        ?.date.slice(0, 7) ?? null,
    categories,
  } satisfies Omit<BudgetMonthResponse, 'currency'>;
}

// ── Recommended budget ──────────────────────────────────────────────────

const RECOMMENDATION_MONTHS = 6;
/** Flexible categories are trimmed at most this far; beyond it the gap is reported instead. */
const MAX_TRIM = 0.5;
/** A payment this many times the usual month is unusual, and left out of the usual level. */
const UNUSUAL_FACTOR = 2;
/** A balance below the warning level is brought back over this many months. */
const RECOVERY_MONTHS = 3;
const LIMIT_STEP = 1_000;
const SAVE_SHARE: Record<BudgetGoal, number> = {
  'within-income': 0,
  'save-10': 0.1,
  'save-20': 0.2,
};

/**
 * A monthly limit for every expense category of the last six full months:
 *
 *  1. The usual level is the median month (so one unusual purchase does not
 *     inflate it), and never below what repeats every month.
 *  2. The goal sets the most that can be spent: the income the forecast
 *     expects for the next three months, less the share to save, less a
 *     third of any shortfall below the warning level.
 *  3. A saving goal trims the flexible categories by its share (10% or 20%)
 *     even when income already leaves that much over, so choosing it always
 *     asks for less. If the usual levels still add up to more than the
 *     target, they are trimmed further in proportion, by up to half.
 *     Mostly-recurring categories are commitments and are never trimmed;
 *     what still does not fit is reported.
 */
export function recommendBudget(ledger: Ledger, goal: BudgetGoal) {
  const { today } = ledger;
  const thisMonth = isoStartOfMonth(today);
  const firstEntry = ledger.entriesBetween('0000-01-01', today)[0]?.date;
  const months = Array.from({ length: RECOMMENDATION_MONTHS }, (_, i) =>
    isoShiftMonth(today, i - RECOMMENDATION_MONTHS),
  ).filter((start) => firstEntry !== undefined && isoEndOfMonth(start) >= firstEntry);

  // Each category's spending, month by month, and its largest single payment.
  const byCategory = new Map<string, { totals: number[]; largest: LedgerEntry | null }>();
  months.forEach((start, i) => {
    for (const e of ledger.entriesBetween(start, isoEndOfMonth(start))) {
      if (e.type !== 'EXPENSE') continue;
      const key = categoryKey(e.category);
      const entry = byCategory.get(key) ?? { totals: months.map(() => 0), largest: null };
      entry.totals[i]! += e.amountCents;
      if (!entry.largest || e.amountCents > entry.largest.amountCents) entry.largest = e;
      byCategory.set(key, entry);
    }
  });

  // Only steady monthly payments are commitments. One whose amount moves (a
  // monthly stock order, say) repeats, but how much it costs is a choice.
  const recurring = new Map<string, number>();
  for (const s of ledger.recurring()) {
    if (s.type !== 'EXPENSE' || !s.steady) continue;
    const key = categoryKey(s.category);
    recurring.set(key, (recurring.get(key) ?? 0) + s.amountCents);
  }

  const base = [...byCategory].map(([key, { totals, largest }]) => {
    const usual = median(totals);
    const recurringCents = recurring.get(key) ?? 0;
    const level = Math.max(usual, recurringCents);
    return {
      key,
      usualCents: usual,
      recurringCents,
      level,
      fixed: recurringCents > 0 && recurringCents >= level * FIXED_SHARE,
      unusual:
        largest && usual > 0 && largest.amountCents > usual * UNUSUAL_FACTOR
          ? { amountCents: largest.amountCents, date: largest.date }
          : null,
    };
  });

  // What the goal allows: the income expected over the next three months.
  const horizonEnd = isoEndOfMonth(isoShiftMonth(today, 3));
  const nextMonths = [1, 2, 3].map((m) => month(isoShiftMonth(today, m)));
  const projected = projectedMonths(ledger.project(isoDaysBetween(today, horizonEnd)), nextMonths);
  const expectedIncomeCents = Math.round(
    projected.reduce((sum, m) => sum + m.incomeCents, 0) / nextMonths.length,
  );
  const { balanceCents, lowBalanceThresholdCents: threshold } = ledger.settings;
  const shortfall =
    balanceCents !== null && threshold !== null
      ? Math.max(0, threshold - ledger.balanceAt(today))
      : 0;
  const targetCents =
    expectedIncomeCents > 0
      ? Math.max(
          0,
          Math.round(expectedIncomeCents * (1 - SAVE_SHARE[goal]) - shortfall / RECOVERY_MONTHS),
        )
      : null;

  const total = base.reduce((sum, l) => sum + l.level, 0);
  const flexible = base.filter((l) => !l.fixed).reduce((sum, l) => sum + l.level, 0);
  // A saving goal always asks flexible costs for at least its share, even when
  // income already leaves that much over; more if the target needs it.
  const needed =
    targetCents !== null && total > targetCents && flexible > 0
      ? (total - targetCents) / flexible
      : 0;
  const trim = flexible > 0 ? Math.min(MAX_TRIM, Math.max(SAVE_SHARE[goal], needed)) : 0;

  const usualLimit = (level: number) =>
    Math.max(LIMIT_STEP, Math.ceil(level / LIMIT_STEP) * LIMIT_STEP);
  const lines = base
    .filter((l) => l.level > 0)
    .map((l) => {
      const cut = l.fixed ? 0 : trim;
      const limitCents =
        cut > 0
          ? Math.max(LIMIT_STEP, Math.floor((l.level * (1 - cut)) / LIMIT_STEP) * LIMIT_STEP)
          : usualLimit(l.level);
      return {
        category: ledger.displayName(l.key),
        limitCents,
        usualCents: l.usualCents,
        recurringCents: l.recurringCents,
        fixed: l.fixed,
        trimmedPct: Math.round(cut * 100),
        unusual: l.unusual,
      };
    })
    .sort((a, b) => b.limitCents - a.limitCents || a.category.localeCompare(b.category));

  const totalCents = lines.reduce((sum, l) => sum + l.limitCents, 0);
  const usualTotalCents = base
    .filter((l) => l.level > 0)
    .reduce((sum, l) => sum + usualLimit(l.level), 0);
  // Rounding each limit to a whole 10 can leave a few euros over a target the
  // trim did meet; only a trim that ran out of room is a real gap.
  const ranOut =
    trim >= MAX_TRIM || (flexible === 0 && targetCents !== null && total > targetCents);
  return {
    today,
    goal,
    monthsOfHistory: months.filter((start) => start < thisMonth).length,
    expectedIncomeCents,
    targetCents,
    totalCents,
    usualTotalCents,
    overByCents: targetCents !== null && ranOut ? Math.max(0, totalCents - targetCents) : 0,
    recovering: shortfall > 0,
    lines,
  } satisfies Omit<BudgetRecommendation, 'currency'>;
}

// ── Simulations ─────────────────────────────────────────────────────────

const roundUp = (cents: number, step: number) => Math.ceil(cents / step) * step;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const mean = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
/** A change read from the ledger, in whole percent. */
const wholePct = (ratio: number) => Math.round(ratio * 100);
/** That change as a scenario's size, within what a rule allows (a cut is at most 100%). */
const sized = (ratio: number) => clamp(wholePct(ratio), 1, 500);

/**
 * At most this many scenarios on the Simulations list, and this many of the
 * next best suggested in "New scenario". With fewer to go round, they are
 * shared between the two.
 */
export const LISTED_SCENARIOS = 5;
export const SUGGESTED_SCENARIOS = 4;
const SCENARIO_HISTORY_MONTHS = 6;
/** A month this close to usual is ordinary, not a pattern to plan for. */
const MIN_SWING = 0.05;
/** Full months needed before a usual month, and a month unlike it, can be told apart. */
const MIN_PATTERN_MONTHS = 3;
/** Without them, a newer business is read week by week: up to this many full weeks… */
const SCENARIO_HISTORY_WEEKS = 12;
/** …and at least this many. */
const MIN_PATTERN_WEEKS = 4;
/** A single payment below this share of a month's costs is too small to plan around. */
const MIN_ONE_OFF_SHARE = 0.1;
/** A sale is a big one at this many times the usual one. */
const BIG_SALE_FACTOR = 2;
/** Sales needed before a usual one can be told from a big one. */
const MIN_SALES = 3;
/** How long before a busy month stock is bought. */
const STOCK_LEAD_DAYS = 14;

/** What the account told us about itself, beyond its ledger. */
export interface ScenarioProfile {
  /** The onboarding answer to "What do you sell?", as saved. */
  industry: string | null;
}

interface MonthlyHistory {
  /** The months read, YYYY-MM, oldest first. */
  months: string[];
  /** One total per month. */
  totals: number[];
  byCategory: Map<string, number[]>;
}

/**
 * Up to six full months of one side of the ledger. A first month that began
 * part-way through (for income or expenses alone) is left out, so it does not
 * read as a slump; a business with no full month yet is read from this month so far.
 */
function monthlyHistory(ledger: Ledger, type: TransactionType): MonthlyHistory {
  const thisMonth = isoStartOfMonth(ledger.today);
  const first =
    ledger.entriesBetween('0000-01-01', ledger.today).find((e) => e.type === type)?.date ??
    thisMonth;
  const firstFull = first.endsWith('-01') ? first : isoShiftMonth(isoStartOfMonth(first), 1);
  const starts: string[] = [];
  for (let m = SCENARIO_HISTORY_MONTHS; m >= 1; m--) {
    const start = isoShiftMonth(thisMonth, -m);
    if (start >= firstFull) starts.push(start);
  }
  const to = starts.length ? isoAddDays(thisMonth, -1) : ledger.today;
  if (!starts.length) starts.push(thisMonth);
  const months = starts.map(month);

  const totals = months.map(() => 0);
  const byCategory = new Map<string, number[]>();
  for (const e of ledger.entriesBetween(starts[0]!, to)) {
    if (e.type !== type) continue;
    const i = months.indexOf(month(e.date));
    const key = categoryKey(e.category);
    const values = byCategory.get(key) ?? months.map(() => 0);
    values[i]! += e.amountCents;
    totals[i]! += e.amountCents;
    byCategory.set(key, values);
  }
  return { months, totals, byCategory };
}

/** The Monday of `date`'s week. */
function isoStartOfWeek(date: string): string {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return isoAddDays(date, -((weekday + 6) % 7));
}

/**
 * The periods a usual one, and one unlike it, are read from: full months
 * where there are enough of them, otherwise full weeks (Monday to Sunday,
 * from the first full week with this side of the ledger to last week), so a
 * business a few weeks old already has a pattern. Null when it has neither.
 */
interface Pattern {
  unit: 'month' | 'week';
  /** Each period: YYYY-MM for a month, its Monday for a week; oldest first. */
  periods: string[];
  totals: number[];
  byCategory: Map<string, number[]>;
}

function pattern(ledger: Ledger, type: TransactionType, monthly: MonthlyHistory): Pattern | null {
  if (monthly.totals.length >= MIN_PATTERN_MONTHS) {
    const { months, totals, byCategory } = monthly;
    return { unit: 'month', periods: months, totals, byCategory };
  }
  const first = ledger
    .entriesBetween('0000-01-01', ledger.today)
    .find((e) => e.type === type)?.date;
  if (!first) return null;
  const thisWeek = isoStartOfWeek(ledger.today);
  const firstWeek = isoStartOfWeek(first);
  const firstFull = firstWeek === first ? first : isoAddDays(firstWeek, 7);
  const periods: string[] = [];
  for (let w = SCENARIO_HISTORY_WEEKS; w >= 1; w--) {
    const start = isoAddDays(thisWeek, -7 * w);
    if (start >= firstFull) periods.push(start);
  }
  if (periods.length < MIN_PATTERN_WEEKS) return null;

  const totals = periods.map(() => 0);
  const byCategory = new Map<string, number[]>();
  for (const e of ledger.entriesBetween(periods[0]!, isoAddDays(thisWeek, -1))) {
    if (e.type !== type) continue;
    const i = Math.floor(isoDaysBetween(periods[0]!, e.date) / 7);
    const key = categoryKey(e.category);
    const values = byCategory.get(key) ?? periods.map(() => 0);
    values[i]! += e.amountCents;
    totals[i]! += e.amountCents;
    byCategory.set(key, values);
  }
  return { unit: 'week', periods, totals, byCategory };
}

/** A period named in a scenario's basis: a month, or the Monday of a week. */
const periodBasis = (unit: Pattern['unit'], period: string) =>
  unit === 'month' ? { month: period } : { week: period };

/** The last three months against the ones before them; zero without both. */
function growth(values: number[]): number {
  if (values.length < 4) return 0;
  const prior = mean(values.slice(0, -3));
  return prior > 0 ? mean(values.slice(-3)) / prior - 1 : 0;
}

interface AgainstUsual {
  /** The period, as `Pattern.periods` names it. */
  period: string;
  cents: number;
  /** How far it was from the usual (median) period, as a share: 0.2 is 20%. */
  ratio: number;
}

/**
 * The period furthest below (or above) the usual one, the latest on a tie;
 * null without a pattern or when no period stands out. `skipEmpty` passes
 * over periods with nothing at all: a cost that was simply not bought, or a
 * week with no sales, which says more about timing than about the business.
 */
function standout(
  values: number[] | undefined,
  { periods }: Pattern,
  direction: 'low' | 'high',
  skipEmpty = false,
): AgainstUsual | null {
  if (!values) return null;
  const usual = median(values);
  if (usual <= 0) return null;
  let pick = -1;
  values.forEach((v, i) => {
    if (skipEmpty && v === 0) return;
    if (pick < 0 || (direction === 'low' ? v <= values[pick]! : v >= values[pick]!)) pick = i;
  });
  if (pick < 0) return null;
  const cents = values[pick]!;
  const ratio = direction === 'low' ? 1 - cents / usual : cents / usual - 1;
  return ratio >= MIN_SWING ? { period: periods[pick]!, cents, ratio } : null;
}

/** The same calendar day a year on; 29 February falls on the 28th. */
function aYearOn(date: string): string {
  const next = `${Number(date.slice(0, 4)) + 1}${date.slice(4)}`;
  return next.endsWith('-02-29') ? next.replace(/29$/, '28') : next;
}

interface Candidate extends ScenarioPreset {
  /** How much this question matters to this business; higher comes first. */
  score: number;
}

/**
 * Ready-made what-ifs built only from what this account holds: its own
 * ledger (its weakest and best months, or weeks while it is too new to have
 * a usual month, its largest costs and income sources, its monthly
 * commitments, its largest one-off payment and its biggest sale), its cash
 * settings (the balance and the low-balance line) and what it sells, from
 * onboarding (its busy season). Each scenario's size comes from one of those
 * figures, and its `basis` names that figure so the text can say why it
 * fits; a scenario the figures cannot support is left out rather than given
 * a stock number. Nothing is random: the same account always gets the same
 * scenarios. The best few are listed; the next few are suggested when
 * building a new one.
 */
export function scenarioPresets(
  ledger: Ledger,
  profile: ScenarioProfile = { industry: null },
): ScenarioPresetsResponse {
  if (ledger.transactionCount === 0) return { presets: [], suggested: [] };
  const { today, settings } = ledger;
  const income = monthlyHistory(ledger, 'INCOME');
  const expense = monthlyHistory(ledger, 'EXPENSE');
  const recent = (values: number[]) => mean(values.slice(-3));
  const monthlyIncome = recent(income.totals);
  const monthlyExpense = recent(expense.totals);
  const margin = monthlyIncome > 0 ? (monthlyIncome - monthlyExpense) / monthlyIncome : -1;
  const ranked = ({ byCategory }: MonthlyHistory) =>
    [...byCategory]
      .map(([key, values]) => ({ key, values, level: recent(values), growth: growth(values) }))
      .filter((c) => c.level > 0)
      .sort((a, b) => b.level - a.level || a.key.localeCompare(b.key));
  const incomes = ranked(income);
  const costs = ranked(expense);
  // Months where there are enough of them, weeks for a newer business.
  const incomePattern = pattern(ledger, 'INCOME', income);
  const expensePattern = pattern(ledger, 'EXPENSE', expense);

  // Spending that is a choice, not a commitment: steady monthly payments are commitments.
  const committed = new Map<string, number>();
  for (const s of ledger.recurring()) {
    if (s.type !== 'EXPENSE' || !s.steady) continue;
    const key = categoryKey(s.category);
    committed.set(key, (committed.get(key) ?? 0) + s.amountCents);
  }
  const flexible = costs.filter((c) => (committed.get(c.key) ?? 0) < c.level * FIXED_SHARE);

  const candidates: Candidate[] = [];
  const add = (score: number, preset: ScenarioPreset) => candidates.push({ ...preset, score });

  if (monthlyIncome > 0) {
    // Its own weakest month (or week), as if every one ran like it. A week
    // with no sales at all is timing, not a pattern.
    if (incomePattern) {
      const { unit, totals } = incomePattern;
      const weakest = standout(totals, incomePattern, 'low', unit === 'week');
      if (weakest) {
        add(45 + Math.min(35, weakest.ratio * 100) + (margin < 0.15 ? 10 : 0), {
          id: 'income-drop',
          rule: { incomeChangePct: -sized(weakest.ratio) },
          basis: { ...periodBasis(unit, weakest.period), pct: wholePct(weakest.ratio) },
        });
      }

      // Its own best month (or week), as if it became the usual one.
      const best = standout(totals, incomePattern, 'high');
      if (best) {
        add(25 + clamp(growth(income.totals) * 150, 0, 35), {
          id: 'income-growth',
          rule: { incomeChangePct: sized(best.ratio) },
          basis: { ...periodBasis(unit, best.period), pct: wholePct(best.ratio) },
        });
      }
    }

    // One source carrying much of the income, beside others: what if it stopped?
    const top = incomes[0];
    const share = top ? top.level / monthlyIncome : 0;
    if (top && incomes.length >= 2 && share >= 0.3 && share <= 0.85) {
      add(share * 90, {
        id: 'top-income-loss',
        rule: { category: ledger.displayName(top.key), categoryChangePct: -100 },
        basis: { pct: wholePct(share) },
      });
    }
  }

  const top = costs[0];
  if (top && monthlyExpense > 0) {
    // The largest cost at its own most expensive month (or week).
    const peak =
      expensePattern && standout(expensePattern.byCategory.get(top.key), expensePattern, 'high');
    if (expensePattern && peak) {
      add(30 + (top.level / monthlyExpense) * 40 + clamp(peak.ratio * 100, 0, 20), {
        id: 'top-cost-up',
        rule: { category: ledger.displayName(top.key), categoryChangePct: sized(peak.ratio) },
        basis: { ...periodBasis(expensePattern.unit, peak.period), pct: wholePct(peak.ratio) },
      });
    }

    // A cost that has been climbing, rising as much again.
    const rising = costs
      .slice(1)
      .filter((c) => c.growth >= 0.15 && c.level >= monthlyExpense * 0.05)
      .sort((a, b) => b.growth - a.growth)[0];
    if (rising) {
      add(35 + clamp(rising.growth * 60, 0, 45), {
        id: 'rising-cost',
        rule: {
          category: ledger.displayName(rising.key),
          categoryChangePct: sized(rising.growth),
        },
        basis: { pct: wholePct(rising.growth) },
      });
    }

    // A cost it can adjust, kept to its own leanest month (or week); most
    // pressing where the margin is thin.
    if (expensePattern) {
      for (const c of flexible) {
        const values = expensePattern.byCategory.get(c.key);
        const lean = standout(values, expensePattern, 'low', true);
        if (!lean) continue;
        add(margin < 0.25 ? 40 + clamp((0.25 - margin) * 100, 0, 40) : 20, {
          id: 'trim-cost',
          rule: { category: ledger.displayName(c.key), categoryChangePct: -sized(lean.ratio) },
          basis: { ...periodBasis(expensePattern.unit, lean.period), cents: lean.cents },
        });
        break;
      }
    }

    // Everything it pays for, rising as much as it already has; without a
    // trend, every month costing what its most expensive one did. Weeks are
    // left out here: a week with the rent in it is not a costly week.
    const costTrend = growth(expense.totals);
    const monthly = expensePattern?.unit === 'month' ? expensePattern : null;
    const dearest = monthly && standout(monthly.totals, monthly, 'high');
    if (costTrend >= MIN_SWING) {
      add(15 + clamp(costTrend * 150, 0, 45), {
        id: 'costs-rise',
        rule: { expenseChangePct: sized(costTrend) },
        basis: { pct: wholePct(costTrend) },
      });
    } else if (dearest) {
      add(10 + clamp(dearest.ratio * 60, 0, 25), {
        id: 'costs-rise',
        rule: { expenseChangePct: sized(dearest.ratio) },
        basis: { month: dearest.period, pct: wholePct(dearest.ratio) },
      });
    }

    // Every month costing as little as its leanest one did.
    const leanest = monthly && standout(monthly.totals, monthly, 'low');
    if (leanest) {
      add(15 + clamp(leanest.ratio * 60, 0, 20), {
        id: 'costs-fall',
        rule: { expenseChangePct: -sized(leanest.ratio) },
        basis: { month: leanest.period, pct: wholePct(leanest.ratio) },
      });
    }
  }

  // A second commitment the size of the largest one it already carries.
  const commitment = ledger
    .recurring()
    .filter((s) => s.type === 'EXPENSE' && s.steady)
    .sort((a, b) => b.amountCents - a.amountCents || a.description.localeCompare(b.description))[0];
  if (commitment) {
    add(margin > 0.1 ? 40 + clamp(margin * 50, 0, 25) : 20, {
      id: 'new-monthly-cost',
      rule: { monthlyCostCents: commitment.amountCents },
      basis: { category: ledger.displayName(categoryKey(commitment.category)) },
    });
  }

  // Its largest single payment of the past year, made again: on its
  // anniversary when that falls within the plan, otherwise a month from now.
  const seriesOf = (e: { type: TransactionType; description: string; category: string }) =>
    `${e.type}|${seriesKey(e.description) || categoryKey(e.category)}`;
  const pastYear = ledger.entriesBetween(isoAddDays(today, -365), today);
  const repeats = new Map<string, number>();
  for (const e of pastYear) repeats.set(seriesOf(e), (repeats.get(seriesOf(e)) ?? 0) + 1);
  const oneOff = pastYear
    .filter((e) => e.type === 'EXPENSE' && repeats.get(seriesOf(e))! <= 2)
    .sort((a, b) => b.amountCents - a.amountCents || b.date.localeCompare(a.date))[0];
  const knownBalance = settings.balanceCents !== null;
  if (oneOff && oneOff.amountCents >= monthlyExpense * MIN_ONE_OFF_SHARE) {
    const again = aYearOn(oneOff.date);
    const seasonal = again > today && again <= isoAddDays(today, FORECAST_DAYS);
    const cushion = knownBalance && ledger.balanceAt(today) > monthlyExpense * 2;
    add(30 + (cushion ? 15 : 0) + (seasonal ? 10 : 0), {
      id: 'one-off-purchase',
      rule: {
        oneOffType: 'EXPENSE',
        oneOffCents: oneOff.amountCents,
        oneOffDate: seasonal ? again : isoAddDays(today, 30),
      },
      basis: { description: oneOff.description, date: oneOff.date },
    });
  }

  // Its biggest sale of the past year, well above a usual one, coming again:
  // on its anniversary when that falls within the plan, otherwise a month from
  // now. A handful of sales is enough, so a new business has it too.
  const sales = pastYear.filter((e) => e.type === 'INCOME');
  const usualSale = median(sales.map((e) => e.amountCents));
  const bigSale = [...sales].sort(
    (a, b) => b.amountCents - a.amountCents || b.date.localeCompare(a.date),
  )[0];
  if (
    bigSale &&
    sales.length >= MIN_SALES &&
    bigSale.amountCents >= usualSale * BIG_SALE_FACTOR &&
    bigSale.amountCents >= monthlyIncome * MIN_ONE_OFF_SHARE
  ) {
    const again = aYearOn(bigSale.date);
    const seasonal = again > today && again <= isoAddDays(today, FORECAST_DAYS);
    add(25 + (margin < 0.1 ? 15 : 0) + (seasonal ? 10 : 0), {
      id: 'big-sale',
      rule: {
        oneOffType: 'INCOME',
        oneOffCents: bigSale.amountCents,
        oneOffDate: seasonal ? again : isoAddDays(today, 30),
      },
      basis: {
        description: bigSale.description,
        date: bigSale.date,
        pct: wholePct(bigSale.amountCents / usualSale),
      },
    });
  }

  // What it sells has a busy season: buying ahead for it, from the cost it
  // buys as it goes. Its own sales that month last year confirm the season,
  // or rule it out.
  const kind = industryKind(profile.industry);
  const stock = flexible[0];
  if (kind && stock) {
    const peakStart = [1, 2, 3]
      .map((m) => isoShiftMonth(today, m))
      .find(
        (start) =>
          INDUSTRY_PEAK_MONTHS[kind].includes(Number(start.slice(5, 7))) &&
          isoDaysBetween(today, start) <= FORECAST_DAYS,
      );
    const lastYear = peakStart && isoShiftMonth(peakStart, -12);
    const known = lastYear && ledger.firstDate !== null && ledger.firstDate <= lastYear;
    const usual = median(income.totals);
    const lift =
      known && usual > 0
        ? ledger.totals(lastYear, isoEndOfMonth(lastYear)).income / usual - 1
        : null;
    if (peakStart && (lift === null || lift >= 0)) {
      const buyOn = isoAddDays(peakStart, -STOCK_LEAD_DAYS);
      const confirmed = lift !== null && lift >= MIN_SWING;
      add(50 + (confirmed ? 15 : 0), {
        id: 'peak-stock-up',
        rule: {
          oneOffType: 'EXPENSE',
          oneOffCents: roundUp(stock.level, 1_000),
          oneOffDate: buyOn > today ? buyOn : isoAddDays(today, 1),
        },
        basis: {
          industry: kind,
          month: month(peakStart),
          category: ledger.displayName(stock.key),
          ...(confirmed ? { pct: wholePct(lift) } : {}),
        },
      });
    }
  }

  // Money coming in: enough to stay above the line where the plan dips under
  // it, or three months of the gap where the business spends more than it earns.
  const floor = settings.lowBalanceThresholdCents ?? 0;
  const plan = knownBalance ? ledger.project(FORECAST_DAYS) : [];
  const below = plan.find((d) => d.balance < floor);
  if (below) {
    const low = lowest(plan);
    const date = isoAddDays(below.date, -7);
    add(90, {
      id: 'cash-injection',
      rule: {
        oneOffType: 'INCOME',
        oneOffCents: roundUp(floor - low.balance, 10_000),
        oneOffDate: date > today ? date : isoAddDays(today, 1),
      },
      basis: { date: below.date, cents: floor },
    });
  } else if (margin < 0 && monthlyExpense > monthlyIncome) {
    const gap = monthlyExpense - monthlyIncome;
    add(35, {
      id: 'cash-injection',
      rule: {
        oneOffType: 'INCOME',
        oneOffCents: roundUp(gap * 3, 10_000),
        oneOffDate: isoAddDays(today, 14),
      },
      basis: { cents: Math.round(gap) },
    });
  }

  const order = (id: ScenarioPreset['id']) => SCENARIO_PRESET_IDS.indexOf(id);
  const best = candidates
    .sort((a, b) => b.score - a.score || order(a.id) - order(b.id))
    .map(({ id, rule, basis }): ScenarioPreset => ({ id, rule, basis }));
  // Both places get a share: the list keeps the most relevant two thirds,
  // and "New scenario" always has one to suggest once there are two or more.
  const suggestedCount = Math.min(
    SUGGESTED_SCENARIOS,
    Math.max(best.length - LISTED_SCENARIOS, Math.floor((best.length + 1) / 3)),
  );
  const listedCount = Math.min(LISTED_SCENARIOS, best.length - suggestedCount);
  return {
    presets: best.slice(0, listedCount),
    suggested: best.slice(listedCount, listedCount + suggestedCount),
  };
}

export function simulate(ledger: Ledger, rule: ScenarioRule) {
  const { today } = ledger;
  const horizon = Math.max(
    FORECAST_DAYS,
    isoDaysBetween(today, isoEndOfMonth(isoShiftMonth(today, 3))),
  );
  const baseDays = ledger.project(horizon);
  const ruleDays = ledger.project(horizon, rule);
  const base = baseDays.slice(0, FORECAST_DAYS + 1);
  const withRule = ruleDays.slice(0, FORECAST_DAYS + 1);
  const keys = [1, 2, 3].map((m) => month(isoShiftMonth(today, m)));
  const baseMonths = projectedMonths(baseDays, keys);
  const ruleMonths = projectedMonths(ruleDays, keys);
  const low = lowest(withRule);
  return {
    today,
    baseline: weekly(base, ledger, false),
    projection: weekly(withRule, ledger, false),
    baselineEndCents: Math.round(base.at(-1)!.balance),
    scenarioEndCents: Math.round(withRule.at(-1)!.balance),
    baselineLowCents: Math.round(lowest(base).balance),
    scenarioLowCents: Math.round(low.balance),
    scenarioLowDate: low.date,
    months: keys.map((m, i) => ({
      month: m,
      baselineNetCents: baseMonths[i]!.netCents,
      scenarioNetCents: ruleMonths[i]!.netCents,
    })),
  } satisfies Omit<SimulationResponse, 'currency'>;
}

// ── Reports ─────────────────────────────────────────────────────────────

const CHANNELS = 3;

export function buildReport(ledger: Ledger, year: number) {
  const { today } = ledger;
  const from = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const to = yearEnd < today ? yearEnd : today;

  const rows = new Map<string, { key: string; type: TransactionType; quarters: number[] }>();
  for (const e of ledger.entriesBetween(from, to)) {
    const key = categoryKey(e.category);
    const id = `${e.type}|${key}`;
    const row = rows.get(id) ?? { key, type: e.type, quarters: [0, 0, 0, 0] };
    row.quarters[Math.floor((Number(e.date.slice(5, 7)) - 1) / 3)]! += e.amountCents;
    rows.set(id, row);
  }
  const t = ledger.totals(from, to);

  const projection =
    yearEnd > today ? ledger.project(isoDaysBetween(today, yearEnd)) : ([] as DayProjection[]);
  const months = Array.from({ length: 12 }, (_, i) => {
    const start = isoShiftMonth(from, i);
    return start <= today
      ? historicalMonth(ledger, start)
      : projectedMonths(projection, [month(start)])[0]!;
  });

  const income = [...rows.values()]
    .filter((r) => r.type === 'INCOME')
    .map((r) => ({ key: r.key, cents: r.quarters.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.cents - a.cents);

  const years = new Set([Number(today.slice(0, 4))]);
  for (const e of ledger.entriesBetween('0000-01-01', today)) years.add(Number(e.date.slice(0, 4)));

  return {
    today,
    year,
    asOf: to,
    summary: {
      revenueCents: t.income,
      expenseCents: t.expense,
      netCents: t.net,
      margin: t.income ? t.net / t.income : null,
    },
    rows: [...rows.values()]
      .map((r) => ({
        category: ledger.displayName(r.key),
        type: r.type,
        quarters: r.quarters,
        totalCents: r.quarters.reduce((a, b) => a + b, 0),
      }))
      .sort((a, b) => b.totalCents - a.totalCents),
    months,
    channels: income.slice(0, CHANNELS).map((c) => ({
      category: ledger.displayName(c.key),
      cents: c.cents,
      shareBasisPoints: t.income ? Math.round((c.cents / t.income) * 10_000) : 0,
    })),
    years: [...years].sort((a, b) => b - a),
  } satisfies Omit<ReportResponse, 'currency'>;
}

// ── Alerts ──────────────────────────────────────────────────────────────

const DUE_SOON_DAYS = 3;

export function buildAlerts(ledger: Ledger, limits: BudgetLimit[]): Alert[] {
  const alerts: Alert[] = [];
  const due = ledger
    .scheduledFlows(DUE_SOON_DAYS)
    .filter((f) => f.type === 'EXPENSE')
    .sort((a, b) => b.amountCents - a.amountCents)[0];
  if (due) {
    alerts.push({
      kind: 'due-soon',
      dueDate: due.date,
      description: due.description,
      amountCents: due.amountCents,
    });
  }

  const over = buildBudgetMonth(ledger, limits, month(ledger.today))
    .lines.filter((l) => l.spentCents > l.limitCents)
    .sort((a, b) => b.spentCents / b.limitCents - a.spentCents / a.limitCents)[0];
  if (over) {
    alerts.push({
      kind: 'over-budget',
      category: over.category,
      spentCents: over.spentCents,
      limitCents: over.limitCents,
    });
  }

  const { balanceCents, lowBalanceThresholdCents: threshold } = ledger.settings;
  if (balanceCents !== null && threshold !== null && ledger.transactionCount > 0) {
    const below = ledger.project(FORECAST_DAYS).find((d) => d.balance < threshold);
    if (below) {
      alerts.push({
        kind: 'low-balance',
        date: below.date,
        balanceCents: Math.round(below.balance),
        thresholdCents: threshold,
      });
    }
  }
  return alerts;
}
