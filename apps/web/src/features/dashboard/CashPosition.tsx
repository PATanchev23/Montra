import { FORECAST_DAYS } from '@montra/shared';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';
import { useCashFlow } from '../../api/finance';
import { LineChart } from '../../components/charts/LineChart';
import { Legend, TooltipRow, TooltipTitle } from '../../components/charts/ChartTooltip';
import { EmptyChartNote } from '../../components/finance/EmptyChartNote';
import { Panel, PanelHeader } from '../../components/ui/Panel';
import { RollingText } from '../../components/ui/RollingText';
import { ErrorState, Skeleton } from '../../components/ui/States';
import { useMessages } from '../../i18n';
import { cn } from '../../lib/cn';
import { formatDate, money } from '../../lib/format';
import { useCurrentMembership } from '../auth/currentUser';
import { cashFlowMessages } from '../cashflow/messages';
import { axisFormatter } from './axis';
import { dashboardMessages } from './messages';

/**
 * Where cash stands today and where it is heading, in one panel at the head
 * of the dashboard: the figure set large at left, the balance line at right,
 * history solid and the projection dashed inside its likely range. The
 * figures come from the business's own cash-flow forecast, the same ones the
 * Cash flow page shows.
 *
 * Until the owner enters a bank balance, balances count from zero and the
 * panel says so (an owner gets the link to fix it). With no transactions at
 * all there is nothing to project: the figure stays, the line gives way to a
 * sentence.
 */
export function CashPosition({ canEdit }: { canEdit: boolean }) {
  const { business } = useCurrentMembership();
  const { data, isError, refetch } = useCashFlow(business.id);
  const m = useMessages(dashboardMessages).hero;
  const cf = useMessages(cashFlowMessages);
  const fmt = (cents: number, sign: 'auto' | 'always' = 'auto') =>
    money(cents, { decimals: 0, sign, currency: data?.currency });

  if (isError) {
    return (
      <Panel aria-label={m.title}>
        <ErrorState title={m.error} onRetry={() => refetch()} />
      </Panel>
    );
  }

  const unset = data !== undefined && data.settings.balanceCents === null;
  const noData = data !== undefined && data.transactionCount === 0;
  const stats = data?.stats;
  const change = stats ? stats.projectedCents - stats.closingCents : 0;
  const horizonDate = data?.balance.at(-1)?.date;
  const threshold = data?.settings.lowBalanceThresholdCents ?? null;
  const belowBuffer = stats !== undefined && threshold !== null && stats.lowestCents < threshold;
  const Arrow = change < 0 ? ArrowDownRight : ArrowUpRight;

  return (
    <Panel aria-labelledby="cash-position" className="p-5 sm:p-6">
      <PanelHeader
        id="cash-position"
        title={unset ? m.titleUnset : m.title}
        actions={
          data &&
          !noData && (
            <Legend
              items={[
                { label: cf.balance.balance, swatch: 'bg-chart-1' },
                { label: cf.balance.projection, swatch: 'border-chart-1', dashed: true },
                { label: cf.balance.range, swatch: 'bg-chart-1/15' },
              ]}
            />
          )
        }
      />
      <div className="mt-4 grid gap-x-12 gap-y-8 xl:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col">
          {stats ? (
            <p className="tabular text-figure-xl text-ink sm:text-hero">
              <RollingText>{fmt(stats.closingCents)}</RollingText>
            </p>
          ) : (
            <Skeleton className="mt-3 h-12 w-56 sm:h-14" />
          )}

          {noData ? null : stats && horizonDate ? (
            <>
              {/* The change carries an arrow and a sign as well as its colour. */}
              <p className="tabular mt-3 flex flex-wrap items-center gap-x-1.5 text-body-lg text-ink-2">
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 font-medium',
                    change < 0 ? 'text-negative' : change > 0 ? 'text-positive' : 'text-ink-2',
                  )}
                >
                  {change !== 0 && <Arrow aria-hidden className="size-4" strokeWidth={2} />}
                  {fmt(change, 'always')}
                </span>
                <span>{m.over(FORECAST_DAYS)}</span>
              </p>

              <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-line pt-6">
                <div className="min-w-0">
                  <dt className="text-body-sm text-muted">
                    {m.projected(formatDate(horizonDate, 'd MMM'))}
                  </dt>
                  <dd className="tabular mt-1 text-figure-sm text-ink">
                    {fmt(stats.projectedCents)}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-body-sm text-muted">{m.lowest}</dt>
                  <dd className="tabular mt-1 text-figure-sm text-ink">{fmt(stats.lowestCents)}</dd>
                  <dd className="tabular text-body-sm text-muted">
                    {m.on(formatDate(stats.lowestDate, 'd MMM'))}
                  </dd>
                </div>
              </dl>
              {threshold !== null && (
                <p
                  className={cn(
                    'mt-4 text-body-sm',
                    belowBuffer ? 'font-medium text-negative' : 'text-muted',
                  )}
                >
                  {belowBuffer ? m.belowBuffer(fmt(threshold)) : m.aboveBuffer(fmt(threshold))}
                </p>
              )}
            </>
          ) : (
            <div className="mt-8 space-y-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}

          {/* Balances count from zero until the owner enters one; the owner gets the way to fix it inline. */}
          {unset && (
            <p className="mt-6 max-w-sm text-body-sm text-muted">
              {canEdit ? cf.note.unsetOwner : cf.note.unsetViewer}
              {canEdit && (
                <>
                  {' '}
                  <Link
                    to="/cash-flow"
                    className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
                  >
                    {cf.note.set}
                  </Link>
                </>
              )}
            </p>
          )}
        </div>

        <div className="min-w-0">
          {!data ? (
            <Skeleton className="h-[248px] w-full rounded-field sm:h-[288px]" />
          ) : (
            <div className="relative">
              <div className={noData ? 'opacity-40' : undefined}>
                <LineChart
                  height={260}
                  ariaLabel={cf.balance.chart}
                  formatTick={axisFormatter(
                    Math.max(0, ...data.balance.map((p) => p.highCents ?? p.balanceCents)),
                  )}
                  series={[
                    {
                      id: 'balance',
                      label: cf.balance.balance,
                      tone: 'primary',
                      area: true,
                      points: data.balance.map((p) => ({
                        date: p.date,
                        value: p.balanceCents,
                        projected: p.projected,
                      })),
                    },
                  ]}
                  band={data.balance
                    .filter((p) => p.projected && p.lowCents !== undefined)
                    .map((p) => ({ date: p.date, low: p.lowCents!, high: p.highCents! }))}
                  markers={noData ? [] : [{ date: data.today, label: cf.balance.today }]}
                  threshold={
                    noData || threshold === null
                      ? undefined
                      : { value: threshold, label: cf.balance.buffer(fmt(threshold)) }
                  }
                  renderTooltip={(date) => {
                    const p = data.balance.find((b) => b.date === date)!;
                    return (
                      <>
                        <TooltipTitle>
                          {formatDate(date, 'EEE, d MMM yyyy')}
                          {p.projected && (
                            <span className="font-normal text-chart-1">
                              {cf.monthly.projectedSuffix}
                            </span>
                          )}
                        </TooltipTitle>
                        <TooltipRow
                          swatch="bg-chart-1"
                          label={cf.balance.balance}
                          value={fmt(p.balanceCents)}
                          emphasis
                        />
                        {p.projected && p.lowCents !== undefined && (
                          <TooltipRow
                            label={cf.balance.range}
                            value={`${fmt(p.lowCents)} – ${fmt(p.highCents!)}`}
                          />
                        )}
                      </>
                    );
                  }}
                />
              </div>
              {noData && (
                <EmptyChartNote
                  canEdit={canEdit}
                  ownerText={cf.page.balanceOwner}
                  withImport={false}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
