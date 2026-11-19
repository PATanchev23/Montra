import {
  isoAddDays,
  isoDaysBetween,
  isoEndOfMonth,
  isoShiftMonth,
  isoStartOfMonth,
} from './dashboard';
import {
  FORECAST_DAYS,
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
  type ScenarioRule,
  type SimulationResponse,
  type UpcomingPayment,
} from './finance';
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
 *  3. If the usual levels add up to more, the flexible categories are
 *     trimmed in proportion, by up to half. Mostly-recurring categories are
 *     commitments and are never trimmed; what still does not fit is reported.
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
  const trim =
    targetCents !== null && total > targetCents && flexible > 0
      ? Math.min(MAX_TRIM, (total - targetCents) / flexible)
      : 0;

  const lines = base
    .filter((l) => l.level > 0)
    .map((l) => {
      const cut = l.fixed ? 0 : trim;
      const limitCents = Math.max(
        LIMIT_STEP,
        cut > 0
          ? Math.floor((l.level * (1 - cut)) / LIMIT_STEP) * LIMIT_STEP
          : Math.ceil(l.level / LIMIT_STEP) * LIMIT_STEP,
      );
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
    overByCents: targetCents !== null && ranOut ? Math.max(0, totalCents - targetCents) : 0,
    recovering: shortfall > 0,
    lines,
  } satisfies Omit<BudgetRecommendation, 'currency'>;
}

// ── Simulations ─────────────────────────────────────────────────────────

const roundUp = (cents: number, step: number) => Math.ceil(cents / step) * step;

/** Ready-made what-ifs, sized to the business's own last three months. */
export function scenarioPresets(ledger: Ledger): ScenarioPreset[] {
  if (ledger.transactionCount === 0) return [];
  const expenses = averageMonthlyByCategory(ledger, 'EXPENSE');
  const incomes = averageMonthlyByCategory(ledger, 'INCOME');
  const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
  const top = [...expenses].sort((a, b) => b[1] - a[1])[0];

  const presets: ScenarioPreset[] = [{ id: 'income-drop', rule: { incomeChangePct: -20 } }];
  if (top) {
    presets.push({
      id: 'top-cost-up',
      rule: { category: ledger.displayName(top[0]), categoryChangePct: 20 },
    });
  }
  presets.push(
    {
      id: 'new-monthly-cost',
      rule: { monthlyCostCents: roundUp(Math.max(sum(expenses) * 0.15, 10_000), 5_000) },
    },
    {
      id: 'one-off-purchase',
      rule: {
        oneOffType: 'EXPENSE',
        oneOffCents: roundUp(Math.max(sum(incomes) * 0.5, 50_000), 10_000),
        oneOffDate: isoAddDays(ledger.today, 30),
      },
    },
    { id: 'income-growth', rule: { incomeChangePct: 10 } },
  );
  return presets;
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
