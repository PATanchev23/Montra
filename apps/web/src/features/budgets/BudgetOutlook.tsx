import { isoShiftMonth, type BudgetMonthResponse } from '@montra/shared';
import { parseISO } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { useCashFlow } from '../../api/finance';
import { CapsuleBarChart } from '../../components/charts/CapsuleBarChart';
import { TooltipRow, TooltipTitle } from '../../components/charts/ChartTooltip';
import { LedgerRow, LedgerSkeleton } from '../../components/finance/LedgerRow';
import { Panel, PanelHeader } from '../../components/ui/Panel';
import { ErrorState } from '../../components/ui/States';
import { useMessages } from '../../i18n';
import { cn } from '../../lib/cn';
import { formatDate, money, relativeDay } from '../../lib/format';
import { useCurrentMembership } from '../auth/currentUser';
import { axisFormatter } from '../dashboard/axis';
import { TypeIcon } from '../transactions/TypeIcon';
import { budgetMessages } from './messages';

type Month = BudgetMonthResponse;

/** At most this many payments are listed; the rest are counted. */
const ROWS = 5;

/**
 * Under "Where it went": what the month still holds. For the month in
 * progress, the payments still expected in the budgeted categories, set
 * against what the budgets have left; for a month that is over, how
 * spending in those categories ran across the six months up to it.
 */
export function BudgetOutlook({
  month,
  className,
}: {
  month: Month | undefined;
  className?: string;
}) {
  if (!month || month.lines.length === 0) return null;
  return month.isCurrent ? (
    <StillToPay month={month} className={className} />
  ) : (
    <LastSixMonths month={month} className={className} />
  );
}

/**
 * The payments the forecast expects before the month ends, in categories
 * that have a budget (from the business's own recurring payments and
 * transactions dated ahead), with their total against the budgets' remainder.
 */
function StillToPay({ month, className }: { month: Month; className?: string }) {
  const { business } = useCurrentMembership();
  const { data, isError, refetch } = useCashFlow(business.id);
  const m = useMessages(budgetMessages).due;
  const fmt = (cents: number) => money(cents, { decimals: 0, currency: month.currency });

  const budgeted = new Set(month.lines.map((l) => l.category.toLocaleLowerCase('en')));
  const due = (data?.upcoming ?? []).filter(
    (u) =>
      u.type === 'EXPENSE' &&
      u.dueDate.slice(0, 7) === month.month &&
      budgeted.has(u.category.toLocaleLowerCase('en')),
  );
  const total = due.reduce((sum, u) => sum + u.amountCents, 0);
  const left = Math.max(0, month.totalLimitCents - month.totalSpentCents);
  const short = total - left;
  const today = parseISO(month.today);

  return (
    <Panel className={cn('flex flex-col p-5 sm:p-6', className)} aria-labelledby="still-to-pay">
      <PanelHeader
        id="still-to-pay"
        className="min-h-0 flex-nowrap items-start"
        title={m.title}
        actions={
          <Link
            to="/cash-flow#upcoming"
            aria-label={m.viewAllLabel}
            className="group inline-flex items-center gap-1.5 text-body-sm leading-6 font-medium whitespace-nowrap text-ink hover:underline"
          >
            {m.viewAll}
            <ArrowRight
              aria-hidden
              className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
              strokeWidth={2}
            />
          </Link>
        }
      />
      <p className="mt-0.5 text-body-sm text-muted">{m.description}</p>

      {isError ? (
        <ErrorState title={m.error} onRetry={() => refetch()} className="py-8" />
      ) : !data ? (
        <div className="mt-2">
          <LedgerSkeleton rows={3} />
        </div>
      ) : due.length === 0 ? (
        <p className="mt-4 py-6 text-center text-body-sm text-muted">{m.none}</p>
      ) : (
        <>
          <ul aria-label={m.title} className="mt-2 mb-4 divide-y divide-line">
            {due.slice(0, ROWS).map((u) => (
              <LedgerRow
                key={u.id}
                icon={<TypeIcon type={u.type} size="sm" />}
                title={u.description}
                subtitle={u.category}
                amount={<span className="tabular font-medium text-ink">{fmt(u.amountCents)}</span>}
                meta={
                  <>
                    {u.certainty === 'estimated' && m.estimated}
                    {relativeDay(u.dueDate, today, 'd MMM')}
                  </>
                }
              />
            ))}
          </ul>
          {due.length > ROWS && (
            <p className="text-body-sm text-muted">{m.more(due.length - ROWS)}</p>
          )}
          {/* The sum, then what it means for the budgets: said in words, not by colour alone. */}
          <div className="mt-auto border-t border-line pt-4">
            <p className="tabular text-body text-ink">
              <span className="font-semibold">{m.due(fmt(total))}</span>
              <span className="text-muted"> · {m.left(fmt(left))}</span>
            </p>
            <p
              className={cn(
                'tabular mt-1 text-body-sm font-medium',
                short > 0 ? 'text-negative' : 'text-positive',
              )}
            >
              {short > 0 ? m.over(fmt(short)) : m.spare(fmt(-short))}
            </p>
          </div>
        </>
      )}
    </Panel>
  );
}

/**
 * Spending in the budgeted categories over the six months ending with the
 * one on screen, one slim capsule a month, from the lines' own history.
 */
function LastSixMonths({ month, className }: { month: Month; className?: string }) {
  const m = useMessages(budgetMessages).history;
  const fmt = (cents: number) => money(cents, { decimals: 0, currency: month.currency });
  const length = Math.max(0, ...month.lines.map((l) => l.history.length));
  const totals = Array.from({ length }, (_, i) =>
    month.lines.reduce((sum, l) => sum + (l.history[i] ?? 0), 0),
  );
  const months = totals.map((_, i) => isoShiftMonth(`${month.month}-01`, i - (length - 1)));
  const average = totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : 0;

  return (
    <Panel className={cn('flex flex-col p-5 sm:p-6', className)} aria-labelledby="last-six-months">
      <PanelHeader
        id="last-six-months"
        className="min-h-0"
        title={m.title}
        description={m.description}
      />
      <div className="mt-5 mb-4">
        <CapsuleBarChart
          ariaLabel={m.chart}
          height={180}
          formatTick={axisFormatter(Math.max(0, ...totals))}
          formatValue={fmt}
          categories={months.map((iso) => ({ key: iso, label: formatDate(iso, 'LLL') }))}
          series={[{ id: 'spent', label: m.spent, values: totals, tone: 'primary' }]}
          describe={(i) => `${formatDate(months[i]!, 'LLLL yyyy')}: ${fmt(totals[i]!)}`}
          renderTooltip={(i) => (
            <>
              <TooltipTitle>{formatDate(months[i]!, 'LLLL yyyy')}</TooltipTitle>
              <TooltipRow swatch="bg-chart-1" label={m.spent} value={fmt(totals[i]!)} emphasis />
            </>
          )}
        />
      </div>
      <dl className="tabular mt-auto grid grid-cols-2 gap-4 border-t border-line pt-4 text-body-sm">
        <div>
          <dt className="text-muted">{m.average}</dt>
          <dd className="mt-0.5 font-medium text-ink">{fmt(average)}</dd>
        </div>
        <div>
          <dt className="text-muted">{m.budget}</dt>
          <dd className="mt-0.5 font-medium text-ink">{fmt(month.totalLimitCents)}</dd>
        </div>
      </dl>
    </Panel>
  );
}
