import type { DashboardResponse } from '@montra/shared';
import { useState } from 'react';
import { CapsuleBarChart } from '../../components/charts/CapsuleBarChart';
import { TooltipRow, TooltipTitle } from '../../components/charts/ChartTooltip';
import { Panel, PanelHeader } from '../../components/ui/Panel';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Skeleton } from '../../components/ui/States';
import { money } from '../../lib/format';
import { bucketLabels } from './period';

type Measure = 'income' | 'expenses';

const per = { day: 'daily', week: 'weekly', month: 'monthly' } as const;

const thousandsFormat = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });

/** Axis ticks in whole currency units for small figures, thousands ("2.5k") for large ones. */
function axisFormatter(maxCents: number) {
  return maxCents >= 1_000_00
    ? (cents: number) => (cents === 0 ? '0' : `${thousandsFormat.format(cents / 100_000)}k`)
    : (cents: number) => String(Math.round(cents / 100));
}

/**
 * The hero of the product. Lavender capsules show the chosen measure for
 * each day, week or month of the period, against slate tracks that run to
 * the top of the scale, so each bar reads as "how full" it was.
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

  const values = points.map((p) => (measure === 'income' ? p.incomeCents : p.expenseCents));
  const total = measure === 'income' ? data?.overview.income.cents : data?.overview.expenses.cents;
  const average = points.length ? Math.round((total ?? 0) / points.length) : 0;
  const empty = data !== undefined && data.overview.transactionCount === 0;

  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="cash-flow-overview">
      <PanelHeader
        id="cash-flow-overview"
        title="Cash flow overview"
        description={
          data ? (
            <span className="tabular">
              {money(total ?? 0, { currency })} {measure === 'income' ? 'earned' : 'spent'} ·{' '}
              {money(average, { currency })} {per[interval]} average
            </span>
          ) : (
            'Income and expenses over the period'
          )
        }
        actions={
          <SegmentedControl
            label="Measure"
            size="sm"
            value={measure}
            onChange={setMeasure}
            options={[
              { value: 'income', label: 'Income' },
              { value: 'expenses', label: 'Expenses' },
            ]}
          />
        }
      />

      <div className="relative mt-6">
        {!data ? (
          <ChartSkeleton />
        ) : (
          <>
            <CapsuleBarChart
              ariaLabel={`${measure === 'income' ? 'Income' : 'Expenses'} by ${interval}, ${periodLabel}`}
              height={284}
              formatTick={axisFormatter(Math.max(0, ...values))}
              categories={points.map((p) => ({
                key: p.start,
                label: bucketLabels(p, interval, points.length).label,
              }))}
              series={[
                {
                  id: measure,
                  label: measure === 'income' ? 'Income' : 'Expenses',
                  values,
                  tone: 'primary',
                },
              ]}
              renderTooltip={(i) => {
                const p = points[i]!;
                return (
                  <>
                    <TooltipTitle>{bucketLabels(p, interval, points.length).title}</TooltipTitle>
                    <TooltipRow
                      swatch={measure === 'income' ? 'bg-chart-1' : 'bg-chart-2'}
                      label="Income"
                      value={money(p.incomeCents, { currency })}
                    />
                    <TooltipRow
                      swatch={measure === 'expenses' ? 'bg-chart-1' : 'bg-chart-2'}
                      label="Expenses"
                      value={money(p.expenseCents, { currency })}
                    />
                    <div className="mt-1.5 border-t border-line pt-1.5">
                      <TooltipRow
                        label="Net"
                        value={money(p.netCents, { currency, sign: 'always' })}
                        emphasis
                      />
                    </div>
                  </>
                );
              }}
            />
            {empty && (
              <p className="pointer-events-none absolute inset-x-0 top-[38%] text-center text-[13px] text-muted">
                No transactions in this period.
              </p>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}

function ChartSkeleton() {
  const heights = [55, 72, 48, 64, 58, 66, 61, 70, 52, 60, 74, 68];
  return (
    <div aria-hidden className="flex h-[284px] items-end gap-[2.2%] pb-[30px] pl-9">
      {heights.map((h, i) => (
        <div key={i} className="flex h-full flex-1 items-end">
          <Skeleton className="w-full rounded-full" style={{ height: `${h}%` }} />
        </div>
      ))}
    </div>
  );
}
