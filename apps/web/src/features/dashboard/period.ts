import {
  dashboardQuerySchema,
  isoDaysBetween,
  isoEndOfMonth,
  resolvePeriod,
  type DashboardPeriod,
  type TrendInterval,
} from '@montra/shared';
import { format, parseISO } from 'date-fns';
import type { DashboardParams } from '../../api/dashboard';

export const periodOptions: { value: DashboardPeriod; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'custom', label: 'Custom range' },
];

const day = (iso: string, pattern: string) => format(parseISO(iso), pattern);

/** "11 Oct – 9 Nov 2026", "1 – 31 Oct 2026", or one day. */
export function rangeLabel(from: string, to: string): string {
  if (from === to) return day(from, 'd MMM yyyy');
  if (from.slice(0, 7) === to.slice(0, 7)) return `${day(from, 'd')} – ${day(to, 'd MMM yyyy')}`;
  if (from.slice(0, 4) === to.slice(0, 4))
    return `${day(from, 'd MMM')} – ${day(to, 'd MMM yyyy')}`;
  return `${day(from, 'd MMM yyyy')} – ${day(to, 'd MMM yyyy')}`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export interface PeriodText {
  /** Short name, e.g. "Last 30 days" or "October 2026". */
  label: string;
  /** Completes "Here's how X performed …". */
  phrase: string;
  /** What the change figures are measured against. */
  comparison: string;
}

/** How to talk about a resolved period. */
export function describePeriod(
  period: DashboardPeriod,
  { from, to, previousFrom }: { from: string; to: string; previousFrom: string },
): PeriodText {
  const days = isoDaysBetween(from, to) + 1;
  switch (period) {
    case '7d':
    case '30d':
    case '90d':
      return {
        label: `Last ${days} days`,
        phrase: `in the last ${days} days`,
        comparison: `vs. previous ${days} days`,
      };
    case 'month':
      return {
        label: day(from, 'MMMM yyyy'),
        phrase: 'this month so far',
        comparison: 'vs. same days last month',
      };
    case 'last-month':
      return {
        label: day(from, 'MMMM yyyy'),
        phrase: `in ${day(from, 'MMMM yyyy')}`,
        comparison: `vs. ${day(previousFrom, 'MMMM')}`,
      };
    case 'custom':
      return {
        label: rangeLabel(from, to),
        phrase: `${from === to ? 'on' : 'over'} ${rangeLabel(from, to)}`,
        comparison: `vs. previous ${plural(days, 'day')}`,
      };
  }
}

/** Why a custom range cannot be shown, by the API's own rules; null when it can. */
export function customRangeProblem(params: DashboardParams): string | null {
  if (params.period !== 'custom') return null;
  if (!params.from || !params.to) return 'Choose a start and an end date.';
  const parsed = dashboardQuerySchema.safeParse(params);
  if (parsed.success) return null;
  const message = parsed.error.issues[0]!.message;
  return message === '`from` must not be after `to`.'
    ? 'The start date is after the end date.'
    : message;
}

/** The dates a period covers on `today` (a custom range as chosen). */
export function previewRange(params: DashboardParams, today: string) {
  if (params.period === 'custom' && customRangeProblem(params)) return null;
  return resolvePeriod(params, today);
}

/** A trend point's axis label and tooltip title. */
export function bucketLabels(
  { start, end }: { start: string; end: string },
  interval: TrendInterval,
  pointCount: number,
): { label: string; title: string } {
  switch (interval) {
    case 'day':
      return {
        label: pointCount <= 7 ? day(start, 'EEE') : day(start, 'd'),
        title: day(start, 'EEEE, d MMMM yyyy'),
      };
    case 'week':
      return { label: day(start, 'd MMM'), title: rangeLabel(start, end) };
    case 'month': {
      const whole = start.endsWith('-01') && end === isoEndOfMonth(start);
      return {
        label: day(start, 'MMM'),
        title: whole ? day(start, 'MMMM yyyy') : rangeLabel(start, end),
      };
    }
  }
}

/** Basis points as a percentage: 6937 → "69.4%", 3 → "<0.1%". */
export function shareLabel(basisPoints: number): string {
  if (basisPoints > 0 && basisPoints < 10) return '<0.1%';
  return `${(basisPoints / 100).toLocaleString('en', { maximumFractionDigits: 1 })}%`;
}
