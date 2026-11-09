import type { ComparedAmount, DashboardResponse } from '@montra/shared';
import { ChartColumn, Receipt, Scale, type LucideIcon } from 'lucide-react';
import { Sparkline, type SparkTone } from '../../components/charts/Sparkline';
import { Delta } from '../../components/ui/Delta';
import { Panel } from '../../components/ui/Panel';
import { Skeleton } from '../../components/ui/States';
import { cn } from '../../lib/cn';
import { money } from '../../lib/format';

type Key = 'income' | 'expenses' | 'net';

interface KpiDefinition {
  key: Key;
  label: string;
  icon: LucideIcon;
  iconClass: string;
  goodWhen: 'up' | 'down';
  /** The trend values its sparkline draws. */
  series: 'incomeCents' | 'expenseCents' | 'netCents';
}

const definitions: KpiDefinition[] = [
  {
    key: 'income',
    label: 'Income',
    icon: ChartColumn,
    iconClass: 'bg-chart-1-soft text-chart-1',
    goodWhen: 'up',
    series: 'incomeCents',
  },
  {
    key: 'expenses',
    label: 'Expenses',
    icon: Receipt,
    iconClass: 'bg-negative-soft text-negative',
    goodWhen: 'down',
    series: 'expenseCents',
  },
  {
    key: 'net',
    label: 'Net cash flow',
    icon: Scale,
    iconClass: 'bg-hover text-ink-2',
    goodWhen: 'up',
    series: 'netCents',
  },
];

function sparkTone(amount: ComparedAmount, goodWhen: 'up' | 'down', key: Key): SparkTone {
  if (key === 'income') return 'analytic';
  if (amount.changeCents === 0) return 'neutral';
  const rising = amount.changeCents > 0;
  return rising === (goodWhen === 'up') ? 'positive' : 'negative';
}

/** Income, expenses and net for the period, each against the equivalent period before. */
export function KpiCards({
  data,
  comparisonLabel,
}: {
  data: DashboardResponse | undefined;
  comparisonLabel: string;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {definitions.map(({ key, label, icon: Icon, iconClass, goodWhen, series }) => {
        const amount = data?.overview[key];
        const currency = data?.currency;
        return (
          <Panel key={key} className="p-5" aria-label={label}>
            <div className="flex gap-3.5">
              <span
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-[11px]',
                  iconClass,
                )}
              >
                <Icon className="size-5" strokeWidth={1.7} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] whitespace-nowrap text-ink-2">{label}</p>
                  {amount && <Delta ratio={amount.changeRatio} goodWhen={goodWhen} />}
                </div>
                {amount ? (
                  <p className="tabular mt-0.5 truncate text-[24px] leading-8 font-semibold tracking-[-0.02em] text-ink">
                    {money(amount.cents, { currency, sign: key === 'net' ? 'auto' : 'never' })}
                  </p>
                ) : (
                  <Skeleton className="mt-1.5 h-7 w-28" />
                )}
              </div>
            </div>
            <div className="mt-4 flex items-end gap-4">
              <div className="w-11 shrink-0">
                {amount && data.trend.points.length > 1 && (
                  <Sparkline
                    values={data.trend.points.map((point) => point[series])}
                    tone={sparkTone(amount, goodWhen, key)}
                    width={44}
                    height={22}
                  />
                )}
              </div>
              {amount ? (
                <p className="tabular min-w-0 text-[12px] leading-snug text-muted">
                  <span className="text-ink-2">
                    {money(amount.changeCents, { currency, sign: 'always' })}
                  </span>{' '}
                  {comparisonLabel}
                </p>
              ) : (
                <Skeleton className="h-4 w-40" />
              )}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
