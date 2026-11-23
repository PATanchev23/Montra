import type { BillingResponse } from '@montra/shared';
import { formatDate } from '../../lib/format';
import type { plansMessages } from './messages';

/** One line on the state of the subscription: renewing, ending, or a failed payment. */
export function subscriptionLine(
  billing: BillingResponse,
  m: (typeof plansMessages)['en'],
): { text: string; warning: boolean } | null {
  if (billing.plan === 'free') return null;
  if (billing.status === 'past_due') return { text: m.pastDue, warning: true };
  if (!billing.currentPeriodEnd) return null;
  const date = formatDate(billing.currentPeriodEnd);
  return billing.cancelAtPeriodEnd
    ? { text: m.ends(date), warning: true }
    : { text: m.renews(date), warning: false };
}
