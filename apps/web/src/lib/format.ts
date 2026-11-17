import { DEFAULT_CURRENCY } from '@montra/shared';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { currentDateLocale, currentIntlLocale, defineMessages, messagesFor } from '../i18n';

/*
 * Every figure and date follows the interface language: en-IE for English
 * (€1,234.56, as before languages existed) and bg-BG for Bulgarian (1234,56 €).
 * Formatters are cached per locale.
 */
const formatters = new Map<string, Intl.NumberFormat>();

function numberFormat(key: string, options: Intl.NumberFormatOptions) {
  const locale = currentIntlLocale();
  const cacheKey = `${locale}|${key}`;
  let formatter = formatters.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    formatters.set(cacheKey, formatter);
  }
  return formatter;
}

export const formatMessages = defineMessages(
  {
    today: 'Today',
    tomorrow: 'Tomorrow',
    yesterday: 'Yesterday',
    morning: 'Good morning',
    afternoon: 'Good afternoon',
    evening: 'Good evening',
  },
  {
    today: 'Днес',
    tomorrow: 'Утре',
    yesterday: 'Вчера',
    morning: 'Добро утро',
    afternoon: 'Добър ден',
    evening: 'Добър вечер',
  },
);

/** A plain count in the interface language: 1,234 or 1234 / 12 345. */
export function count(value: number) {
  return numberFormat('count', { maximumFractionDigits: 0 }).format(value);
}

/** A number with up to `decimals` fraction digits: 12.5 or 12,5. */
export function decimal(value: number, decimals = 1) {
  return numberFormat(`dec${decimals}`, { maximumFractionDigits: decimals }).format(value);
}

/** Typographic minus so signed figures align with plus signs. */
const MINUS = '−';

export interface MoneyOptions {
  /** 0 for glanceable headline figures, 2 (default) for ledgers. */
  decimals?: 0 | 2;
  /** `always` prefixes + / −; `auto` only marks negatives. */
  sign?: 'auto' | 'always' | 'never';
  /** ISO 4217 code; the business currency where one is known. Defaults to EUR. */
  currency?: string;
}

export function money(
  cents: number,
  { decimals = 2, sign = 'auto', currency = DEFAULT_CURRENCY }: MoneyOptions = {},
) {
  const value = sign === 'never' ? Math.abs(cents) / 100 : cents / 100;
  const text = numberFormat(`m${decimals}${sign}${currency}`, {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: sign === 'always' ? 'exceptZero' : 'auto',
  }).format(value);
  return text.replace('-', MINUS);
}

/** €15.2K — for chart axes and tight spaces. */
export function compactMoney(cents: number, currency: string = DEFAULT_CURRENCY) {
  return numberFormat(`compact${currency}`, {
    style: 'currency',
    currency,
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

/** A Date in a date-fns pattern, with month and weekday names in the interface language. */
export function formatDay(date: Date, pattern = 'd MMM yyyy') {
  return format(date, pattern, { locale: currentDateLocale() });
}

export function formatDate(isoDate: string, pattern = 'd MMM yyyy') {
  return formatDay(parseISO(isoDate), pattern);
}

/** "Today", "Tomorrow", "Yesterday" (in the interface language), or a short date. */
export function relativeDay(isoDate: string, today: Date, pattern = 'd MMM yyyy') {
  const diff = differenceInCalendarDays(parseISO(isoDate), today);
  const m = messagesFor(formatMessages);
  if (diff === 0) return m.today;
  if (diff === 1) return m.tomorrow;
  if (diff === -1) return m.yesterday;
  return formatDate(isoDate, pattern);
}

export function greeting(now = new Date()) {
  const m = messagesFor(formatMessages);
  const hour = now.getHours();
  if (hour < 12) return m.morning;
  if (hour < 18) return m.afternoon;
  return m.evening;
}
