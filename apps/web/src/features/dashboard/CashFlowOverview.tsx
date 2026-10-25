import { addMonths, format, parseISO } from 'date-fns';
import { useState } from 'react';
import { DEMO_TODAY, useMonthlyFlows } from '../../api/finance';
import { CapsuleBarChart } from '../../components/charts/CapsuleBarChart';
import { TooltipRow, TooltipTitle } from '../../components/charts/ChartTooltip';
import { Panel, PanelHeader } from '../../components/ui/Panel';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Select } from '../../components/ui/Select';
import { ErrorState, Skeleton } from '../../components/ui/States';
import type { FlowRange } from '../../demo/api';
import { compactMoney, money } from '../../lib/format';

type Measure = 'income' | 'expenses';

const rangeOptions: { value: FlowRange; label: string }[] = [
  { value: '12m', label: 'Last 12 months' },
  { value: 'ytd', label: 'This year' },
  { value: '6m', label: 'Last 6 months' },
];

/**
 * The hero of the product. Lavender capsules show the chosen measure per
 * month against slate tracks that run to the top of the scale, so each bar
 * reads as "how full" that month was.
 */
export function CashFlowOverview() {
  const [range, setRange] = useState<FlowRange>('12m');
  const [measure, setMeasure] = useState<Measure>('income');
  const { data, isPending, isError, refetch } = useMonthlyFlows(range);

  const values = data?.map((m) => (measure === 'income' ? m.incomeCents : m.expenseCents)) ?? [];
  const total = values.reduce((a, b) => a + b, 0);
  const average = values.length ? total / values.length : 0;
  const currentKey = format(DEMO_TODAY, 'yyyy-MM');

  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="cash-flow-overview">
      <PanelHeader
        id="cash-flow-overview"
        title="Cash flow overview"
        description={
          data ? (
            <span className="tabular">
              {money(total, { decimals: 0 })} {measure === 'income' ? 'earned' : 'spent'} ·{' '}
              {compactMoney(average)} monthly average
            </span>
          ) : (
            'Monthly income and expenses'
          )
        }
        actions={
          <>
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
            <Select
              label="Chart range"
              size="sm"
              value={range}
              onChange={setRange}
              options={rangeOptions}
              className="w-[136px]"
            />
          </>
        }
      />

      <div className="mt-6">
        {isError ? (
          <ErrorState onRetry={() => refetch()} className="h-[280px] justify-center py-0" />
        ) : isPending ? (
          <ChartSkeleton />
        ) : (
          <CapsuleBarChart
            ariaLabel={`Monthly ${measure}, ${rangeOptions.find((r) => r.value === range)?.label}`}
            height={284}
            categories={data.map((m) => ({ key: m.key, label: m.label }))}
            series={[
              {
                id: measure,
                label: measure === 'income' ? 'Income' : 'Expenses',
                values,
                tone: 'primary',
              },
            ]}
            renderTooltip={(i) => {
              const m = data[i]!;
              const month = parseISO(`${m.key}-01`);
              return (
                <>
                  <TooltipTitle>
                    {format(month, 'MMMM yyyy')}
                    {m.key === currentKey && (
                      <span className="font-normal text-muted"> · to date</span>
                    )}
                  </TooltipTitle>
                  <TooltipRow
                    swatch={measure === 'income' ? 'bg-chart-1' : 'bg-chart-2'}
                    label="Income"
                    value={money(m.incomeCents, { decimals: 0 })}
                  />
                  <TooltipRow
                    swatch={measure === 'expenses' ? 'bg-chart-1' : 'bg-chart-2'}
                    label="Expenses"
                    value={money(m.expenseCents, { decimals: 0 })}
                  />
                  <div className="mt-1.5 border-t border-line pt-1.5">
                    <TooltipRow
                      label="Net"
                      value={money(m.netCents, { decimals: 0, sign: 'always' })}
                      emphasis
                    />
                  </div>
                </>
              );
            }}
          />
        )}
      </div>
    </Panel>
  );
}

function ChartSkeleton() {
  const heights = [55, 72, 48, 64, 58, 66, 61, 70, 52, 60, 74, 68];
  const start = addMonths(DEMO_TODAY, -11);
  return (
    <div aria-hidden className="flex h-[284px] items-end gap-[2.2%] pb-[30px] pl-9">
      {heights.map((h, i) => (
        <div key={format(addMonths(start, i), 'yyyy-MM')} className="flex h-full flex-1 items-end">
          <Skeleton className="w-full rounded-full" style={{ height: `${h}%` }} />
        </div>
      ))}
    </div>
  );
}
