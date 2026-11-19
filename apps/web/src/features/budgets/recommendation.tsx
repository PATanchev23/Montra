import type { BudgetRecommendation } from '@montra/shared';
import { CapsuleProgress } from '../../components/finance/CapsuleProgress';
import { useMessages } from '../../i18n';
import { cn } from '../../lib/cn';
import { budgetMessages } from './messages';

/** The recommended total against the income the forecast expects, and what that means. */
export function RecommendationSummary({
  data,
  fmt,
}: {
  data: BudgetRecommendation;
  fmt: (cents: number) => string;
}) {
  const m = useMessages(budgetMessages).recommend;
  const { targetCents, totalCents, expectedIncomeCents, overByCents } = data;
  const status =
    targetCents === null
      ? { tone: 'text-ink-2', text: m.noIncome }
      : overByCents > 0
        ? {
            tone: 'text-negative',
            text: data.lines.some((l) => l.trimmedPct > 0)
              ? m.overBy(fmt(overByCents))
              : m.overByFixed(fmt(overByCents)),
          }
        : {
            tone: 'text-ink-2',
            text: m.leaves(fmt(Math.max(0, expectedIncomeCents - totalCents))),
          };

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-body-sm text-ink-2">
          {m.total} <span className="tabular text-figure-sm text-ink">{fmt(totalCents)}</span>{' '}
          <span className="text-muted">{m.perMonth}</span>
        </p>
        {targetCents !== null && (
          <p className="tabular text-caption text-muted">
            {m.expectedIncome(fmt(expectedIncomeCents))}
          </p>
        )}
      </div>
      {targetCents !== null && (
        <div className="mt-3">
          <CapsuleProgress
            label={m.totalOfIncome}
            value={totalCents}
            max={expectedIncomeCents}
            pace={targetCents}
          />
        </div>
      )}
      <p className={cn('mt-2.5 text-body-sm', status.tone)}>
        {status.text}
        {data.recovering && <> {m.recovering}</>}
      </p>
    </div>
  );
}
