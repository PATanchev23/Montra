import type { BudgetRecommendation } from '@montra/shared';
import { messagesFor } from '../../i18n';
import { formatDate } from '../../lib/format';
import { budgetMessages } from './messages';

export type RecommendedLine = BudgetRecommendation['lines'][number];

/** Why a recommended limit is what it is, in one short sentence. */
export function reason(line: RecommendedLine, fmt: (cents: number) => string): string {
  const m = messagesFor(budgetMessages).recommend;
  const base = line.fixed
    ? m.why.fixed(fmt(line.recurringCents))
    : line.trimmedPct > 0
      ? m.why.trimmed(fmt(line.usualCents), line.trimmedPct)
      : m.why.usual(fmt(line.usualCents));
  return line.unusual
    ? `${base} ${m.why.unusual(fmt(line.unusual.amountCents), formatDate(line.unusual.date, 'd MMM'))}`
    : base;
}
