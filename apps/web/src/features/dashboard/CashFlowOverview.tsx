import type { DashboardResponse } from '@montra/shared';
import { useState } from 'react';
import { CapsuleBarChart } from '../../components/charts/CapsuleBarChart';
import { TooltipRow, TooltipTitle } from '../../components/charts/ChartTooltip';
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
 */
export function CashFlowOverview({
  data,
  periodLabel,
}: {
  data: DashboardResponse | undefined;
  periodLabel: string;
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
    <Panel className="flex flex-col p-5 sm:p-6" aria-labelledby="cash-flow-overview">
      <PanelHeader
        id="cash-flow-overview"
        title={m.title}
        description={
          data ? (
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

      {/* The plot takes whatever height the row gives it, never less than a readable chart. */}
      <div className="relative mt-6 min-h-[240px] flex-1 sm:min-h-[300px]">
        {!data ? (
          <ChartSkeleton />
        ) : (
          <div className="absolute inset-0">
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
            {empty && (
              <p className="pointer-events-none absolute inset-x-0 top-[38%] text-center text-body-sm text-muted">
                {m.noTransactions}
              </p>
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
          <Skeleton className="w-full max-w-11 rounded-full" style={{ height: `${h}%` }} />
        </div>
      ))}
    </div>
  );
}
