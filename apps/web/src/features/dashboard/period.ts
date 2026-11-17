import {
  dashboardQuerySchema,
  isoDaysBetween,
  isoEndOfMonth,
  resolvePeriod,
  type DashboardPeriod,
  type TrendInterval,
} from '@montra/shared';
import type { DashboardParams } from '../../api/dashboard';
import { messagesFor } from '../../i18n';
import { localizeMessage } from '../../i18n/serverMessages';
import { decimal, formatDate } from '../../lib/format';
import { dashboardMessages } from './messages';

/** The reporting periods, in menu order. */
export const PERIODS: DashboardPeriod[] = ['7d', '30d', '90d', 'month', 'last-month', 'custom'];

/** The menu's choices, named in the interface language. */
export function periodOptions(): { value: DashboardPeriod; label: string }[] {
  const names = messagesFor(dashboardMessages).periods;
  return PERIODS.map((value) => ({ value, label: names[value] }));
}

const day = (iso: string, pattern: string) => formatDate(iso, pattern);

/** "11 Oct – 9 Nov 2026", "1 – 31 Oct 2026", or one day. */
export function rangeLabel(from: string, to: string): string {
  if (from === to) return day(from, 'd MMM yyyy');
  if (from.slice(0, 7) === to.slice(0, 7)) return `${day(from, 'd')} – ${day(to, 'd MMM yyyy')}`;
  if (from.slice(0, 4) === to.slice(0, 4))
    return `${day(from, 'd MMM')} – ${day(to, 'd MMM yyyy')}`;
  return `${day(from, 'd MMM yyyy')} – ${day(to, 'd MMM yyyy')}`;
}

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
  const m = messagesFor(dashboardMessages);
  const days = isoDaysBetween(from, to) + 1;
  switch (period) {
    case '7d':
    case '30d':
    case '90d':
      return m.rolling(days);
    case 'month':
      return { label: day(from, 'LLLL yyyy'), ...m.thisMonth };
    case 'last-month':
      return {
        label: day(from, 'LLLL yyyy'),
        ...m.lastMonth(day(from, 'LLLL yyyy'), day(previousFrom, 'LLLL')),
      };
    case 'custom':
      return { label: rangeLabel(from, to), ...m.custom(rangeLabel(from, to), days) };
  }
}

/** Why a custom range cannot be shown, by the API's own rules; null when it can. */
export function customRangeProblem(params: DashboardParams): string | null {
  if (params.period !== 'custom') return null;
  const m = messagesFor(dashboardMessages);
  if (!params.from || !params.to) return m.rangeStartMissing;
  const parsed = dashboardQuerySchema.safeParse(params);
  if (parsed.success) return null;
  const message = parsed.error.issues[0]!.message;
  return message === '`from` must not be after `to`.' ? m.rangeReversed : localizeMessage(message);
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
        title: whole ? day(start, 'LLLL yyyy') : rangeLabel(start, end),
      };
    }
  }
}

/** Basis points as a percentage: 6937 → "69.4%" (Bulgarian "69,4%"), 3 → "<0.1%". */
export function shareLabel(basisPoints: number): string {
  if (basisPoints > 0 && basisPoints < 10) return `<${decimal(0.1)}%`;
  return `${decimal(basisPoints / 100)}%`;
}
