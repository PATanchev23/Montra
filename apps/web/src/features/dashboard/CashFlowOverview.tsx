import type { DashboardResponse } from '@montra/shared';
import { CapsuleBarChart } from '../../components/charts/CapsuleBarChart';
import { Legend, TooltipRow, TooltipTitle } from '../../components/charts/ChartTooltip';
import { EmptyChartNote } from '../../components/finance/EmptyChartNote';
import { Panel, PanelHeader } from '../../components/ui/Panel';
import { Skeleton } from '../../components/ui/States';
import { money } from '../../lib/format';
import { useMessages } from '../../i18n';
import { axisFormatter } from './axis';
import { dashboardMessages } from './messages';
import { bucketLabels } from './period';

/**
 * How the chosen period ran, day by day (or week by week, month by month):
 * income rises from a zero line in ink and expenses hang below it in grey,
 * one column per period, so a short and sparse period still reads at a
 * glance and each capsule has its period's full width. A quiet period is a
 * dot on the line. Reading a period shows its income, expenses and net.
 *
 * With no transactions at all (`noData`), the empty plot stays in place but
 * steps back, and a note over it says what fills it: with an Import button
 * for an owner, plainly for a viewer, who cannot add anything.
 */
export function CashFlowOverview({
  data,
  periodLabel,
  noData = false,
  canEdit = false,
}: {
  data: DashboardResponse | undefined;
  periodLabel: string;
  noData?: boolean;
  canEdit?: boolean;
}) {
  const points = data?.trend.points ?? [];
  const interval = data?.trend.interval ?? 'day';
  const currency = data?.currency;
  const m = useMessages(dashboardMessages).overview;
  const empty = data !== undefined && data.overview.transactionCount === 0;
  const labels = points.map((p) => bucketLabels(p, interval, points.length));
  const formatValue = (cents: number) => money(cents, { currency });
  const whole = (cents: number, sign?: 'always') => money(cents, { currency, decimals: 0, sign });
  const series = [
    {
      id: 'income',
      label: m.income,
      values: points.map((p) => p.incomeCents),
      tone: 'primary' as const,
    },
    {
      id: 'expenses',
      label: m.expenses,
      values: points.map((p) => p.expenseCents),
      tone: 'secondary' as const,
    },
  ];
  const peak = Math.max(0, ...series.flatMap((s) => s.values));

  return (
    <Panel
      className="flex flex-col justify-between p-5 sm:p-6"
      aria-labelledby="cash-flow-overview"
    >
      <PanelHeader
        id="cash-flow-overview"
        title={m.title}
        description={
          noData ? (
            m.noTransactionsYet
          ) : data ? (
            <span className="tabular">
              {m.compare(
                whole(data.overview.income.cents),
                whole(data.overview.expenses.cents),
                whole(data.overview.income.cents - data.overview.expenses.cents, 'always'),
              )}
            </span>
          ) : (
            m.fallback
          )
        }
        actions={
          !noData && (
            <Legend
              items={[
                { label: m.income, swatch: 'bg-chart-1' },
                { label: m.expenses, swatch: 'bg-chart-2' },
              ]}
            />
          )
        }
      />

      {/* A low plot: it takes up spare height in the row, but never more than 300px, so the capsules stay short. */}
      <div className="relative mt-6 h-[220px] sm:h-auto sm:max-h-[300px] sm:min-h-[260px] sm:flex-1">
        {!data ? (
          <ChartSkeleton />
        ) : (
          <div className="absolute inset-0">
            <div className={noData ? 'absolute inset-0 opacity-40' : 'absolute inset-0'}>
              <CapsuleBarChart
                // A new range starts with nothing pinned.
                key={`${data.period.from}/${data.period.to}/${interval}`}
                ariaLabel={m.chartLabel(interval, periodLabel)}
                layout="diverging"
                height="fill"
                formatTick={axisFormatter(peak)}
                formatValue={formatValue}
                categories={points.map((p, i) => ({ key: p.start, label: labels[i]!.label }))}
                series={series}
                describe={(i) => {
                  const p = points[i]!;
                  return m.describe(
                    labels[i]!.title,
                    formatValue(p.incomeCents),
                    formatValue(p.expenseCents),
                    money(p.netCents, { currency, sign: 'always' }),
                  );
                }}
                renderTooltip={(i) => {
                  const p = points[i]!;
                  return (
                    <>
                      <TooltipTitle>{labels[i]!.title}</TooltipTitle>
                      <TooltipRow
                        swatch="bg-chart-1"
                        label={m.income}
                        value={formatValue(p.incomeCents)}
                      />
                      <TooltipRow
                        swatch="bg-chart-2"
                        label={m.expenses}
                        value={formatValue(p.expenseCents)}
                      />
                      <div className="mt-1.5 border-t border-line pt-1.5">
                        <TooltipRow
                          label={m.net}
                          value={money(p.netCents, { currency, sign: 'always' })}
                          emphasis
                        />
                      </div>
                    </>
                  );
                }}
              />
            </div>
            {noData ? (
              <EmptyChartNote canEdit={canEdit} ownerText={m.firstTransactions} />
            ) : (
              empty && (
                <p className="pointer-events-none absolute inset-x-0 top-[38%] text-center text-body-sm text-muted">
                  {m.noTransactions}
                </p>
              )
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}

function ChartSkeleton() {
  const heights = [55, 72, 48, 64, 58, 66, 61, 70, 52, 60, 74, 68];
  return (
    <div aria-hidden className="absolute inset-0 flex items-end gap-[2.2%] pb-8 pl-10">
      {heights.map((h, i) => (
        <div key={i} className="flex h-full flex-1 items-end justify-center">
          <Skeleton className="w-full max-w-8 rounded-full" style={{ height: `${h}%` }} />
        </div>
      ))}
    </div>
  );
}
