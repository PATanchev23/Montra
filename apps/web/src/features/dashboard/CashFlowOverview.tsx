import type { DashboardResponse } from '@montra/shared';
import { useState } from 'react';
import { CapsuleBarChart } from '../../components/charts/CapsuleBarChart';
import { TooltipRow, TooltipTitle } from '../../components/charts/ChartTooltip';
import { EmptyChartNote } from '../../components/finance/EmptyChartNote';
import { Panel, PanelHeader } from '../../components/ui/Panel';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Skeleton } from '../../components/ui/States';
import { money } from '../../lib/format';
import { useMessages } from '../../i18n';
import { axisFormatter } from './axis';
import { dashboardMessages } from './messages';
import { bucketLabels } from './period';

type Measure = 'income' | 'expenses';

/**
 * The hero of the dashboard. Ink capsules show the chosen measure for each
 * day, week or month of the period, against pale tracks that run to the top
 * of the scale, so each bar reads as "how full" it was. Reading a period
 * shows its income, expenses and net together.
 *
 * With no transactions at all (`noData`), the empty tracks stay in place but
 * step back, and a note over them says what fills them: with an Import button
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
  const [measure, setMeasure] = useState<Measure>('income');
  const points = data?.trend.points ?? [];
  const interval = data?.trend.interval ?? 'day';
  const currency = data?.currency;
  const m = useMessages(dashboardMessages).overview;
  const noun = measure === 'income' ? m.income : m.expenses;

  const values = points.map((p) => (measure === 'income' ? p.incomeCents : p.expenseCents));
  const total = measure === 'income' ? data?.overview.income.cents : data?.overview.expenses.cents;
  const average = points.length ? Math.round((total ?? 0) / points.length) : 0;
  const empty = data !== undefined && data.overview.transactionCount === 0;
  const labels = points.map((p) => bucketLabels(p, interval, points.length));
  const formatValue = (cents: number) => money(cents, { currency });

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
              {m.summary(formatValue(total ?? 0), measure, formatValue(average), interval)}
            </span>
          ) : (
            m.fallback
          )
        }
        actions={
          <SegmentedControl
            label={m.measure}
            size="sm"
            value={measure}
            onChange={setMeasure}
            options={[
              { value: 'income', label: m.income },
              { value: 'expenses', label: m.expenses },
            ]}
          />
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
                // A new range starts with nothing pinned; switching the measure keeps the pin.
                key={`${data.period.from}/${data.period.to}/${interval}`}
                ariaLabel={m.chartLabel(noun, interval, periodLabel)}
                height="fill"
                formatTick={axisFormatter(Math.max(0, ...values))}
                formatValue={formatValue}
                categories={points.map((p, i) => ({ key: p.start, label: labels[i]!.label }))}
                series={[{ id: 'measure', label: noun, values, tone: 'primary' }]}
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
                        swatch={measure === 'income' ? 'bg-chart-1' : 'bg-chart-4'}
                        label={m.income}
                        value={formatValue(p.incomeCents)}
                      />
                      <TooltipRow
                        swatch={measure === 'expenses' ? 'bg-chart-1' : 'bg-chart-4'}
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
