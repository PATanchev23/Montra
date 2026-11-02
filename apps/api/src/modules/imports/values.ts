import type { DateFormat, DecimalSeparator, TransactionType } from '@montra/shared';
import { cellText, type Cell } from './types';

/*
 * Reading amounts, dates and types written by people and other systems.
 * Every parser either returns a value or says, in words the owner can act
 * on, why it could not. Nothing is guessed: a value that could mean two
 * things is reported, not resolved.
 */

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

const ok = <T>(value: T): Parsed<T> => ({ ok: true, value });
const fail = <T>(message: string): Parsed<T> => ({ ok: false, message });

const CURRENCY_SYMBOLS: Record<string, string> = { '€': 'EUR', '£': 'GBP', $: 'USD' };

export interface Amount {
  /** Signed: negative for amounts written as negative. */
  cents: number;
  /** A currency written next to the number, e.g. "€" or "EUR". */
  currency: string | null;
}

/**
 * Reads "1,234.50", "1.234,50", "-12.5", "(12.50)", "€12.50", "12.50 EUR".
 * `separator` is the decimal separator; the other one, spaces and
 * apostrophes may group thousands. More than two decimals is an error, as
 * no supported currency has them.
 */
export function parseAmount(cell: Cell | undefined, separator: DecimalSeparator): Parsed<Amount> {
  if (typeof cell === 'number') {
    if (!Number.isFinite(cell)) return fail('The amount is not a number.');
    const cents = Math.round(cell * 100);
    if (Math.abs(cell * 100 - cents) > 1e-6) return fail('Use at most two decimal places.');
    return ok({ cents, currency: null });
  }

  let text = cellText(cell).replace(/[\u00a0\u202f]/g, ' ');
  if (text === '') return fail('The amount is missing.');

  let negative = false;
  let currency: string | null = null;
  const takeSign = () => {
    const sign = /^([-−+])\s*/.exec(text) ?? /\s*([-−])$/.exec(text);
    if (sign) {
      if (sign[1] !== '+') negative = !negative;
      text = text.replace(sign[0], '');
    }
  };
  const takeCurrency = () => {
    const match = /^([€£$]|[A-Z]{3})\s*/.exec(text) ?? /\s*([€£$]|[A-Z]{3})$/.exec(text);
    if (match && !currency) {
      currency = CURRENCY_SYMBOLS[match[1]!] ?? match[1]!;
      text = text.replace(match[0], '');
    }
  };

  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1).trim();
  }
  takeSign();
  takeCurrency();
  takeSign();

  const grouping = separator === '.' ? /[,\s']/ : /[.\s']/;
  const [whole = '', fraction, extra] = text.split(separator);
  if (extra !== undefined || whole === '') return fail(`“${cellText(cell)}” is not an amount.`);
  if (fraction !== undefined && !/^\d{1,2}$/.test(fraction)) {
    return fail(
      /^\d+$/.test(fraction)
        ? 'Use at most two decimal places.'
        : `“${cellText(cell)}” is not an amount.`,
    );
  }
  let digits = whole;
  if (grouping.test(whole)) {
    // Thousands groups must be exactly three digits: "1,234" yes, "12,34" no.
    const groups = whole.split(grouping);
    if (!/^\d{1,3}$/.test(groups[0]!) || groups.slice(1).some((group) => !/^\d{3}$/.test(group))) {
      return fail(`“${cellText(cell)}” is not an amount.`);
    }
    digits = groups.join('');
  }
  if (!/^\d+$/.test(digits)) return fail(`“${cellText(cell)}” is not an amount.`);

  const cents = Number(digits) * 100 + Number((fraction ?? '').padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) return fail('The amount is too large.');
  return ok({ cents: negative ? -cents : cents, currency });
}

/** The decimal separator that reads every value; only one can, unless none is used at all. */
export function detectDecimalSeparator(cells: (Cell | undefined)[]): DecimalSeparator {
  const texts = cells.filter(
    (cell): cell is string => typeof cell === 'string' && cell.trim() !== '',
  );
  const reads = (separator: DecimalSeparator) =>
    texts.filter((text) => parseAmount(text, separator).ok).length;
  return reads(',') > reads('.') ? ',' : '.';
}

const ISO_DATE = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/;
const DAY_MONTH_YEAR = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:[T\s,].*)?$/;

function calendarDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

/** Excel serial day numbers (1900 date system), for date columns stored as plain numbers. */
export function excelSerialToDate(serial: number, date1904 = false): string | null {
  if (!Number.isFinite(serial) || serial < 1 || serial >= 2958466) return null;
  const days = Math.floor(serial);
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  // Excel counts a 29 February 1900 that never was; serials before it are one day early.
  const offset = !date1904 && days < 61 ? days + 1 : days;
  return new Date(epoch + offset * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Reads a calendar date. Year-first dates (2026-10-05, also with a time and
 * offset, as platforms export them) need no format; day and month in either
 * order need `format`. Any time of day is dropped, keeping the date as written.
 */
export function parseDate(cell: Cell | undefined, format: DateFormat): Parsed<string> {
  if (typeof cell === 'number') {
    const date = excelSerialToDate(cell);
    return date ? ok(date) : fail(`“${cell}” is not a date.`);
  }
  const text = cellText(cell);
  if (text === '') return fail('The date is missing.');

  const iso = ISO_DATE.exec(text);
  const dmy = iso ? null : DAY_MONTH_YEAR.exec(text);
  let date: string | null = null;
  if (iso) {
    date = calendarDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  } else if (dmy && format !== 'YMD') {
    const [first, second] = [Number(dmy[1]), Number(dmy[2])];
    date =
      format === 'DMY'
        ? calendarDate(Number(dmy[3]), second, first)
        : calendarDate(Number(dmy[3]), first, second);
  }
  return date ? ok(date) : fail(`“${text}” is not a date Montra can read.`);
}

/**
 * The day/month order of a column's dates. A value like 25/10/2026 settles
 * it; when every value could be read either way, the owner must choose.
 */
export function detectDateFormat(cells: (Cell | undefined)[]): DateFormat | null {
  let dayFirst = false;
  let monthFirst = false;
  let undecided = false;
  for (const cell of cells) {
    const match = typeof cell === 'string' ? DAY_MONTH_YEAR.exec(cell.trim()) : null;
    if (!match) continue;
    const [first, second] = [Number(match[1]), Number(match[2])];
    if (first > 12) dayFirst = true;
    else if (second > 12) monthFirst = true;
    else undecided = true;
  }
  if (dayFirst !== monthFirst) return dayFirst ? 'DMY' : 'MDY';
  // Both seen means the column is inconsistent; rows that don't fit are reported.
  if (dayFirst && monthFirst) return 'DMY';
  return undecided ? null : 'YMD';
}

const TYPE_WORDS: Record<string, TransactionType> = {};
for (const word of [
  'income',
  'in',
  'credit',
  'cr',
  'deposit',
  'revenue',
  'sale',
  'sales',
  'inflow',
  'receipt',
  '+',
  'приход',
  'доход',
]) {
  TYPE_WORDS[word] = 'INCOME';
}
for (const word of [
  'expense',
  'expenses',
  'out',
  'debit',
  'dr',
  'withdrawal',
  'cost',
  'outflow',
  'spend',
  '-',
  'разход',
]) {
  TYPE_WORDS[word] = 'EXPENSE';
}

/** "Income", "credit", "приход" … → INCOME; null for anything else. */
export function parseType(cell: Cell | undefined): TransactionType | null {
  return TYPE_WORDS[cellText(cell).toLowerCase()] ?? null;
}

/** For matching headers and descriptions: case, accents width and spacing ignored. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}#]+/gu, ' ')
    .trim();
}
