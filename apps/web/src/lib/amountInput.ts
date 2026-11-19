import { MAX_CENTS, toCents } from '@montra/shared';
import { localizeMessage } from '../i18n/serverMessages';

const PATTERN = /^\d+(?:[.,]\d+)?$/;

export type ParsedAmount = { ok: true; cents: number | null } | { ok: false; message: string };

/**
 * An amount as typed in a settings field, e.g. "2 500" or "1250,50", as
 * cents; empty is null. `signed` accepts a leading minus (an overdrawn
 * balance). Messages are in the interface language.
 */
export function parseAmount(text: string, { signed = false } = {}): ParsedAmount {
  let compact = text.replace(/\s/g, '');
  if (compact === '') return { ok: true, cents: null };
  let negative = false;
  if (signed && /^[-−]/.test(compact)) {
    negative = true;
    compact = compact.slice(1);
  }
  const fail = (message: string): ParsedAmount => ({
    ok: false,
    message: localizeMessage(message),
  });
  if (!PATTERN.test(compact)) return fail('Enter an amount such as 2500 or 2500.50.');
  if ((compact.split(/[.,]/)[1] ?? '').length > 2) return fail('Use at most two decimal places.');
  const cents = toCents(Number(compact.replace(',', '.')));
  if (!Number.isSafeInteger(cents) || cents > MAX_CENTS) return fail('The amount is too large.');
  return { ok: true, cents: negative ? -cents : cents };
}

/** Cents as an editable amount without trailing zeros: 250000 → "2500", 125050 → "1250.50". */
export function amountInputText(cents: number | null): string {
  if (cents === null) return '';
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}
