/**
 * Money is stored and transported as integer minor units (cents) to avoid
 * floating-point drift. Conversion to decimal happens only at the edges:
 * user input and display.
 */
export type Cents = number;

export const DEFAULT_CURRENCY = 'EUR';
export const DEFAULT_LOCALE = 'en-IE';

/** Converts a decimal amount (e.g. 12.345) to cents, rounding half away from zero. */
export function toCents(amount: number): Cents {
  if (!Number.isFinite(amount)) throw new RangeError(`Invalid amount: ${amount}`);
  // Work from the decimal string so 1.005 rounds to 101, not 100.
  const [whole = '0', fraction = ''] = Math.abs(amount).toFixed(10).split('.');
  const cents =
    Number(whole) * 100 + Number(fraction.slice(0, 2)) + (Number(fraction[2]) >= 5 ? 1 : 0);
  return amount < 0 ? -cents : cents;
}

export function fromCents(cents: Cents): number {
  assertCents(cents);
  return cents / 100;
}

export function assertCents(value: number): asserts value is Cents {
  if (!Number.isSafeInteger(value)) throw new RangeError(`Cents must be a safe integer: ${value}`);
}

export interface FormatMoneyOptions {
  currency?: string;
  locale?: string;
  /** Drop the fraction for large, glanceable figures (e.g. chart axes). */
  compact?: boolean;
  /** Always show a leading + or − sign. */
  signed?: boolean;
}

export function formatMoney(cents: Cents, options: FormatMoneyOptions = {}): string {
  const {
    currency = DEFAULT_CURRENCY,
    locale = DEFAULT_LOCALE,
    compact = false,
    signed = false,
  } = options;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 2,
    minimumFractionDigits: compact ? 0 : 2,
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(fromCents(cents));
}
