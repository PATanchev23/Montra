import { DEFAULT_CURRENCY, DEFAULT_LOCALE } from '@montra/shared';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';

const formatters = new Map<string, Intl.NumberFormat>();

function numberFormat(key: string, options: Intl.NumberFormatOptions) {
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(DEFAULT_LOCALE, options);
    formatters.set(key, formatter);
  }
  return formatter;
}

/** Typographic minus so signed figures align with plus signs. */
const MINUS = '−';

export interface MoneyOptions {
  /** 0 for glanceable headline figures, 2 (default) for ledgers. */
  decimals?: 0 | 2;
  /** `always` prefixes + / −; `auto` only marks negatives. */
  sign?: 'auto' | 'always' | 'never';
}

export function money(cents: number, { decimals = 2, sign = 'auto' }: MoneyOptions = {}) {
  const value = sign === 'never' ? Math.abs(cents) / 100 : cents / 100;
  const text = numberFormat(`m${decimals}${sign}`, {
    style: 'currency',
    currency: DEFAULT_CURRENCY,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: sign === 'always' ? 'exceptZero' : 'auto',
  }).format(value);
  return text.replace('-', MINUS);
}

/** €15.2K — for chart axes and tight spaces. */
export function compactMoney(cents: number) {
  return numberFormat('compact', {
    style: 'currency',
    currency: DEFAULT_CURRENCY,
    notation: 'compact',
    maximumFractionDigits: 1,
  })
    .format(cents / 100)
    .replace('-', MINUS);
}

/** Axis ticks in thousands: 0, 10, 20 … */
export function thousands(cents: number) {
  return numberFormat('k', { maximumFractionDigits: 0 }).format(cents / 100_000);
}

export function percent(ratio: number, { signed = false, decimals = 0 } = {}) {
  return numberFormat(`p${signed}${decimals}`, {
    style: 'percent',
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
    signDisplay: signed ? 'exceptZero' : 'auto',
  })
    .format(ratio)
    .replace('-', MINUS);
}

export function formatDate(isoDate: string, pattern = 'd MMM yyyy') {
  return format(parseISO(isoDate), pattern);
}

/** "Today", "Tomorrow", "Yesterday", or a short date. */
export function relativeDay(isoDate: string, today: Date, pattern = 'd MMM yyyy') {
  const diff = differenceInCalendarDays(parseISO(isoDate), today);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return formatDate(isoDate, pattern);
}

export function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
