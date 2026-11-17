import { messagesFor } from '../../i18n';
import { decimal } from '../../lib/format';
import { dashboardMessages } from './messages';

/** Typographic minus, so negative ticks line up with the money figures. */
const MINUS = '−';

/**
 * Axis ticks for a chart whose largest absolute value is `maxCents`: whole
 * currency units for small figures, thousands ("2.5k", "2,5 хил.") for large ones.
 */
export function axisFormatter(maxCents: number) {
  const sign = (cents: number) => (cents < 0 ? MINUS : '');
  const suffix = messagesFor(dashboardMessages).thousandsSuffix;
  return Math.abs(maxCents) >= 1_000_00
    ? (cents: number) =>
        cents === 0 ? '0' : `${sign(cents)}${decimal(Math.abs(cents) / 100_000)}${suffix}`
    : (cents: number) => `${sign(cents)}${Math.round(Math.abs(cents) / 100)}`;
}
