import type { DashboardResponse } from '@montra/shared';
import { Sparkline } from '../../components/charts/Sparkline';
import { Delta } from '../../components/ui/Delta';
import { Panel } from '../../components/ui/Panel';
import { Skeleton } from '../../components/ui/States';
import { money } from '../../lib/format';

import { useMessages } from '../../i18n';
import { common } from '../../i18n/common';
import { dashboardMessages } from './messages';
type Key = 'net' | 'income' | 'expenses';

interface KpiDefinition {
  key: Key;
  goodWhen: 'up' | 'down';
  /** The trend values its line adds up, bucket by bucket. */
  series: 'netCents' | 'incomeCents' | 'expenseCents';
}

const definitions: KpiDefinition[] = [
  { key: 'net', goodWhen: 'up', series: 'netCents' },
  { key: 'income', goodWhen: 'up', series: 'incomeCents' },
  { key: 'expenses', goodWhen: 'down', series: 'expenseCents' },
];

/** Running total across the period, so each line ends on the figure above it. */
function cumulative(values: number[]) {
  let sum = 0;
  return values.map((value) => (sum += value));
}

/**
 * Net cash flow, income and expenses for the period, each against the
 * equivalent period before. The figure leads in ink; only the change takes
 * colour, by meaning rather than direction (rising expenses read red).
 *
 * `noData` is a business with no transactions at all: the tiles keep their
 * shape and show €0.00, but there is nothing to compare or draw, so the
 * change, the comparison line and the sparkline give way to "No data yet".
 * A period that is merely empty is real information and keeps them.
 */
export function KpiCards({
  data,
  comparisonLabel,
  noData = false,
}: {
  data: DashboardResponse | undefined;
  comparisonLabel: string;
  noData?: boolean;
}) {
  const labels = useMessages(dashboardMessages).kpi;
  const delta = useMessages(common).delta;
  return (
    <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
      {definitions.map(({ key, goodWhen, series }) => {
        const label = labels[key];
        const amount = data?.overview[key];
        const currency = data?.currency;
        return (
          <Panel key={key} role="group" aria-label={label} className="@container p-5 sm:p-6">
            {/* The change sits on the label's line, so every tile has the same anatomy at any width. */}
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-body text-ink-2">{label}</p>
              {amount && !noData && (
                <Delta
                  ratio={amount.changeRatio}
                  cents={amount.cents}
                  previousCents={amount.previousCents}
                  goodWhen={goodWhen}
                  className="text-body"
                />
              )}
            </div>
            {amount ? (
              <p className="tabular mt-1.5 text-figure text-ink">
                {money(amount.cents, { currency, sign: key === 'net' ? 'auto' : 'never' })}
              </p>
            ) : (
              <Skeleton className="mt-2.5 h-8 w-40" />
            )}
            <div className="mt-4 flex items-end justify-between gap-4">
              {amount && noData ? (
                <p className="min-w-0 text-body-sm text-muted">{delta.noData}</p>
              ) : amount ? (
                <p className="tabular min-w-0 text-body-sm text-muted">
                  <span className="font-medium text-ink-2">
                    {money(amount.changeCents, { currency, sign: 'always' })}
                  </span>{' '}
                  {comparisonLabel}
                </p>
              ) : (
                <Skeleton className="h-4 w-44" />
              )}
              {amount && !noData && data.trend.points.length > 1 && (
                <Sparkline
                  values={cumulative(data.trend.points.map((point) => point[series]))}
                  tone="ink"
                  width={64}
                  height={24}
                  // Narrow tiles give the comparison the whole line.
                  className="hidden @[18rem]:block"
                />
              )}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
