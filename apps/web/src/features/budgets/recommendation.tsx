import type { BudgetRecommendation } from '@montra/shared';
import { Badge } from '../../components/ui/Badge';
import { CapsuleProgress } from '../../components/finance/CapsuleProgress';
import { useMessages } from '../../i18n';
import { cn } from '../../lib/cn';
import { budgetMessages } from './messages';

/**
 * The recommended total as the figure, what the goal saves against a usual
 * month beside it, and the total against the income the forecast expects.
 */
export function RecommendationSummary({
  data,
  fmt,
}: {
  data: BudgetRecommendation;
  fmt: (cents: number) => string;
}) {
  const m = useMessages(budgetMessages).recommend;
  const { targetCents, totalCents, usualTotalCents, expectedIncomeCents, overByCents } = data;
  const belowUsual = usualTotalCents - totalCents;
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
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <p className="text-caption text-muted">{m.total}</p>
          <p className="mt-0.5 text-body-sm text-muted">
            <span className="tabular text-figure text-ink">{fmt(totalCents)}</span> {m.perMonth}
          </p>
        </div>
        {belowUsual > 0 && (
          <Badge tone="positive" className="mb-1.5 tabular">
            {m.belowUsual(fmt(belowUsual))}
          </Badge>
        )}
      </div>
      {targetCents !== null && (
        <div className="mt-4">
          <CapsuleProgress
            label={m.totalOfIncome}
            value={totalCents}
            max={expectedIncomeCents}
            pace={targetCents}
          />
          <p className="tabular mt-2 text-caption text-muted">
            {m.expectedIncome(fmt(expectedIncomeCents))}
          </p>
        </div>
      )}
      <p className={cn('mt-3 text-body-sm', status.tone)}>
        {status.text}
        {data.recovering && <> {m.recovering}</>}
      </p>
      {/* A saving goal that could trim nothing should say why, not look ignored. */}
      {data.goal !== 'within-income' && belowUsual <= 0 && overByCents === 0 && (
        <p className="mt-1.5 text-caption text-muted">{m.nothingToTrim}</p>
      )}
    </div>
  );
}
