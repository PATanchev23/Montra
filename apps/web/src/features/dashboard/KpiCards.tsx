import { ChartColumn, Receipt, Wallet, type LucideIcon } from 'lucide-react';
import { Sparkline, type SparkTone } from '../../components/charts/Sparkline';
import { Delta } from '../../components/ui/Delta';
import { Panel } from '../../components/ui/Panel';
import { Skeleton } from '../../components/ui/States';
import type { DashboardData } from '../../demo/api';
import type { Kpi } from '../../demo/types';
import { cn } from '../../lib/cn';
import { money } from '../../lib/format';

interface KpiDefinition {
  key: keyof DashboardData['kpis'];
  label: string;
  icon: LucideIcon;
  iconClass: string;
  goodWhen: 'up' | 'down';
}

const definitions: KpiDefinition[] = [
  {
    key: 'balance',
    label: 'Cash balance',
    icon: Wallet,
    iconClass: 'bg-positive-soft text-positive',
    goodWhen: 'up',
  },
  {
    key: 'revenue',
    label: 'Revenue',
    icon: ChartColumn,
    iconClass: 'bg-chart-1-soft text-chart-1',
    goodWhen: 'up',
  },
  {
    key: 'expenses',
    label: 'Expenses',
    icon: Receipt,
    iconClass: 'bg-negative-soft text-negative',
    goodWhen: 'down',
  },
];

function sparkTone(kpi: Kpi, goodWhen: 'up' | 'down', key: string): SparkTone {
  if (key === 'revenue') return 'analytic';
  const rising = kpi.changeCents >= 0;
  return rising === (goodWhen === 'up') ? 'positive' : 'negative';
}

export function KpiCards({
  kpis,
  comparisonLabel,
}: {
  kpis: DashboardData['kpis'] | undefined;
  comparisonLabel: string;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {definitions.map(({ key, label, icon: Icon, iconClass, goodWhen }) => {
        const kpi = kpis?.[key];
        return (
          <Panel key={key} className="p-5">
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
                  {kpi && <Delta ratio={kpi.changeRatio} goodWhen={goodWhen} />}
                </div>
                {kpi ? (
                  <p className="tabular mt-0.5 text-[24px] leading-8 font-semibold tracking-[-0.02em] text-ink">
                    {money(kpi.valueCents, { decimals: 0 })}
                  </p>
                ) : (
                  <Skeleton className="mt-1.5 h-7 w-28" />
                )}
              </div>
            </div>
            <div className="mt-4 flex items-end gap-4">
              <div className="w-11 shrink-0">
                {kpi && (
                  <Sparkline
                    values={kpi.trend}
                    tone={sparkTone(kpi, goodWhen, key)}
                    width={44}
                    height={22}
                  />
                )}
              </div>
              {kpi ? (
                <p className="tabular min-w-0 truncate text-[12px] text-muted">
                  <span className="text-ink-2">
                    {money(kpi.changeCents, { decimals: 0, sign: 'always' })}
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
