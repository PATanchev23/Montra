const thousandsFormat = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });

/** Typographic minus, so negative ticks line up with the money figures. */
const MINUS = '−';

/**
 * Axis ticks for a chart whose largest absolute value is `maxCents`: whole
 * currency units for small figures, thousands ("2.5k") for large ones.
 */
export function axisFormatter(maxCents: number) {
  const sign = (cents: number) => (cents < 0 ? MINUS : '');
  return Math.abs(maxCents) >= 1_000_00
    ? (cents: number) =>
        cents === 0 ? '0' : `${sign(cents)}${thousandsFormat.format(Math.abs(cents) / 100_000)}k`
    : (cents: number) => `${sign(cents)}${Math.round(Math.abs(cents) / 100)}`;
}

/** How each trend bucket is named in running text. */
export const bucketNoun = { day: 'day', week: 'week', month: 'month' } as const;
