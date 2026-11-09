import { z } from 'zod';
import { currencySchema } from './business';
import { transactionDateSchema, transactionSchema } from './transactions';

/*
 * The Dashboard summary: GET /businesses/:businessId/dashboard.
 *
 * Periods are calendar dates in the business's time zone, inclusive at both
 * ends. Their maths lives here so the API and the web app always agree on
 * which days a period covers and what it is compared with.
 */

export const DASHBOARD_PERIODS = ['7d', '30d', '90d', 'month', 'last-month', 'custom'] as const;
export const dashboardPeriodSchema = z.enum(DASHBOARD_PERIODS);
export type DashboardPeriod = z.infer<typeof dashboardPeriodSchema>;

/** Longest custom range, in days (about five years). */
export const DASHBOARD_MAX_RANGE_DAYS = 1830;
/** Expense categories listed before the rest are summed as "Other". */
export const DASHBOARD_TOP_CATEGORIES = 5;
export const DASHBOARD_RECENT_COUNT = 6;

export const dashboardQuerySchema = z
  .object({
    period: dashboardPeriodSchema.default('30d'),
    /** Custom range only, inclusive. */
    from: transactionDateSchema.optional(),
    to: transactionDateSchema.optional(),
  })
  .superRefine((query, ctx) => {
    if (query.period !== 'custom') {
      if (query.from || query.to) {
        ctx.addIssue({
          code: 'custom',
          message: '`from` and `to` apply only to a custom period.',
          path: ['from'],
        });
      }
      return;
    }
    if (!query.from || !query.to) {
      ctx.addIssue({
        code: 'custom',
        message: 'A custom period needs both `from` and `to`.',
        path: [query.from ? 'to' : 'from'],
      });
      return;
    }
    if (query.from > query.to) {
      ctx.addIssue({ code: 'custom', message: '`from` must not be after `to`.', path: ['from'] });
    } else if (isoDaysBetween(query.from, query.to) + 1 > DASHBOARD_MAX_RANGE_DAYS) {
      ctx.addIssue({
        code: 'custom',
        message: `Choose at most ${DASHBOARD_MAX_RANGE_DAYS} days.`,
        path: ['to'],
      });
    }
  });
export type DashboardQuery = z.input<typeof dashboardQuerySchema>;

export const trendIntervalSchema = z.enum(['day', 'week', 'month']);
export type TrendInterval = z.infer<typeof trendIntervalSchema>;

// ── Date maths on yyyy-mm-dd strings (UTC arithmetic, no time of day) ─────

const toUtc = (date: string) =>
  Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const DAY_MS = 86_400_000;

export function isoAddDays(date: string, days: number): string {
  return fromUtc(toUtc(date) + days * DAY_MS);
}

/** Whole days from `from` to `to`; 0 for the same day. */
export function isoDaysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

export const isoStartOfMonth = (date: string) => `${date.slice(0, 7)}-01`;

export function isoEndOfMonth(date: string): string {
  const year = +date.slice(0, 4);
  const month = +date.slice(5, 7);
  return fromUtc(Date.UTC(year, month, 0));
}

/** The first day of the month `months` away from `date`'s month. */
export function isoShiftMonth(date: string, months: number): string {
  const year = +date.slice(0, 4);
  const month = +date.slice(5, 7) - 1 + months;
  return fromUtc(Date.UTC(year, month, 1));
}

/** Today's date where the business is, e.g. still yesterday in New York after midnight in Sofia. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export interface ResolvedPeriod {
  period: DashboardPeriod;
  from: string;
  to: string;
  /** The equivalent period before, for comparison. */
  previousFrom: string;
  previousTo: string;
  /** How the trend is grouped. */
  interval: TrendInterval;
}

/** Days are grouped so a chart has between 7 and about 31 bars. */
export function trendInterval(days: number): TrendInterval {
  if (days <= 31) return 'day';
  if (days <= 92) return 'week';
  return 'month';
}

/**
 * The dates a period covers on `today`, and the equivalent period before it:
 * the same number of days for rolling and custom periods; the same days of
 * the previous month for this month so far; the month before for last month.
 */
export function resolvePeriod(
  query: { period: DashboardPeriod; from?: string; to?: string },
  today: string,
): ResolvedPeriod {
  let from: string;
  let to: string;
  let previousFrom: string;
  let previousTo: string;
  switch (query.period) {
    case '7d':
    case '30d':
    case '90d':
    case 'custom': {
      if (query.period === 'custom') {
        from = query.from!;
        to = query.to!;
      } else {
        const length = Number(query.period.slice(0, -1));
        from = isoAddDays(today, -(length - 1));
        to = today;
      }
      const length = isoDaysBetween(from, to) + 1;
      previousTo = isoAddDays(from, -1);
      previousFrom = isoAddDays(previousTo, -(length - 1));
      break;
    }
    case 'month': {
      // Month to date, against the same days of last month (up to its end).
      from = isoStartOfMonth(today);
      to = today;
      previousFrom = isoShiftMonth(today, -1);
      const sameDay = isoAddDays(previousFrom, isoDaysBetween(from, to));
      const previousEnd = isoEndOfMonth(previousFrom);
      previousTo = sameDay < previousEnd ? sameDay : previousEnd;
      break;
    }
    case 'last-month': {
      from = isoShiftMonth(today, -1);
      to = isoEndOfMonth(from);
      previousFrom = isoShiftMonth(today, -2);
      previousTo = isoEndOfMonth(previousFrom);
      break;
    }
  }
  return {
    period: query.period,
    from,
    to,
    previousFrom,
    previousTo,
    interval: trendInterval(isoDaysBetween(from, to) + 1),
  };
}

/**
 * The trend's buckets, covering [from, to] without gaps: single days, runs
 * of seven days from `from` (the last may be shorter), or calendar months
 * clipped to the period.
 */
export function trendBuckets(
  from: string,
  to: string,
  interval: TrendInterval,
): { start: string; end: string }[] {
  const buckets: { start: string; end: string }[] = [];
  let start = from;
  while (start <= to) {
    const natural =
      interval === 'day'
        ? start
        : interval === 'week'
          ? isoAddDays(start, 6)
          : isoEndOfMonth(start);
    const end = natural < to ? natural : to;
    buckets.push({ start, end });
    start = isoAddDays(end, 1);
  }
  return buckets;
}

/**
 * Splits 10000 basis points across amounts in proportion, rounding so the
 * parts always add up to exactly 100% (largest remainder).
 */
export function shareBasisPoints(amounts: number[]): number[] {
  const total = amounts.reduce((sum, value) => sum + value, 0);
  if (total === 0) return amounts.map(() => 0);
  const exact = amounts.map((value) => (value * 10_000) / total);
  const floors = exact.map(Math.floor);
  let left = 10_000 - floors.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of order) {
    if (left <= 0) break;
    floors[index]! += 1;
    left -= 1;
  }
  return floors;
}

// ── Response ─────────────────────────────────────────────────────────────

const cents = z.int();

/** A figure for the period, the equivalent figure before it, and the change. */
export const comparedAmountSchema = z.object({
  cents,
  previousCents: cents,
  changeCents: cents,
  /** e.g. 0.12 for +12%; null when the previous figure is zero. */
  changeRatio: z.number().nullable(),
});
export type ComparedAmount = z.infer<typeof comparedAmountSchema>;

export const dashboardResponseSchema = z.object({
  currency: currencySchema,
  /** Today in the business's time zone, which rolling periods count back from. */
  today: z.iso.date(),
  period: z.object({
    period: dashboardPeriodSchema,
    from: z.iso.date(),
    to: z.iso.date(),
    days: z.int().min(1),
    previousFrom: z.iso.date(),
    previousTo: z.iso.date(),
  }),
  overview: z.object({
    income: comparedAmountSchema,
    expenses: comparedAmountSchema,
    /** Income minus expenses. */
    net: comparedAmountSchema,
    transactionCount: z.int().min(0),
    previousTransactionCount: z.int().min(0),
  }),
  trend: z.object({
    interval: trendIntervalSchema,
    points: z.array(
      z.object({
        start: z.iso.date(),
        end: z.iso.date(),
        incomeCents: cents,
        expenseCents: cents,
        netCents: cents,
      }),
    ),
  }),
  expenseBreakdown: z.object({
    totalCents: cents,
    items: z.array(
      z.object({
        /** The category, or null for the remaining categories summed together. */
        category: z.string().nullable(),
        cents,
        /** Share of total expenses in basis points (1/100 of a percent); the items sum to 10000. */
        shareBasisPoints: z.int().min(0).max(10_000),
        transactionCount: z.int().min(0),
      }),
    ),
  }),
  /** The business's latest transactions, newest first, whatever the period. */
  recent: z.array(transactionSchema),
});
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
