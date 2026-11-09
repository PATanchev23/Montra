import type { DashboardResponse } from '@montra/shared';
import { parseISO } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { DonutChart } from '../../components/charts/DonutChart';
import { Amount } from '../../components/finance/Amount';
import { rankFills, rankSwatches } from '../../components/finance/categoryVisuals';
import { LedgerRow, LedgerSkeleton } from '../../components/finance/LedgerRow';
import { Badge } from '../../components/ui/Badge';
import { Panel, PanelHeader } from '../../components/ui/Panel';
import { Skeleton } from '../../components/ui/States';
import { cn } from '../../lib/cn';
import { money, relativeDay } from '../../lib/format';
import { entryType } from '../transactions/display';
import { TypeIcon } from '../transactions/TypeIcon';
import { shareLabel } from './period';

function ViewAll({ to, label = 'View all' }: { to: string; label?: string }) {
  return (
    <Link
      to={to}
      className="group inline-flex items-center gap-1 rounded-md text-[13px] font-medium text-chart-1 hover:text-ink"
    >
      {label}
      <ArrowRight
        className="size-3.5 transition-transform group-hover:translate-x-0.5"
        strokeWidth={2}
      />
    </Link>
  );
}

const OTHER = 'Other categories';

// ── Expense breakdown ────────────────────────────────────────────────────

export function ExpenseBreakdownPanel({
  data,
  periodLabel,
}: {
  data: DashboardResponse | undefined;
  periodLabel: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const breakdown = data?.expenseBreakdown;
  const currency = data?.currency;
  const items = (breakdown?.items ?? []).map((item) => ({
    ...item,
    name: item.category ?? OTHER,
  }));
  const activeItem = items.find((item) => item.name === active);

  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="breakdown-title">
      <PanelHeader
        id="breakdown-title"
        title="Expense breakdown"
        actions={periodLabel && <Badge>{periodLabel}</Badge>}
      />
      {!breakdown ? (
        <div className="mt-5 flex items-center gap-6">
          <Skeleton className="size-[136px] rounded-full" />
          <div className="flex-1 space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
      ) : items.length === 0 ? (
        <p className="mt-5 rounded-control bg-sunken px-4 py-6 text-center text-[13px] text-muted">
          No expenses in this period.
        </p>
      ) : (
        <div className="mt-5 flex items-center gap-5">
          <DonutChart
            ariaLabel="Expenses by category"
            size={136}
            thickness={18}
            active={active}
            onActiveChange={setActive}
            items={items.map((item, i) => ({
              id: item.name,
              label: item.name,
              value: item.cents,
              fill: rankFills[i] ?? 'fill-chart-2',
            }))}
            center={
              <>
                <span className="tabular text-[15px] font-semibold tracking-[-0.02em] text-ink">
                  {money(activeItem?.cents ?? breakdown.totalCents, { currency })}
                </span>
                <span className="max-w-[96px] truncate text-[12px] text-muted">
                  {activeItem?.name ?? 'Total'}
                </span>
              </>
            }
          />
          <ul className="min-w-0 flex-1 space-y-2.5" aria-label="Expense categories">
            {items.map((item, i) => (
              <li
                key={item.name}
                onMouseEnter={() => setActive(item.name)}
                onMouseLeave={() => setActive(null)}
                className={cn(
                  'flex items-start gap-2.5 transition-opacity',
                  active && active !== item.name && 'opacity-45',
                )}
              >
                <span
                  className={cn(
                    'mt-[5px] size-2.5 shrink-0 rounded-full',
                    rankSwatches[i] ?? 'bg-chart-2',
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2" title={item.name}>
                  {item.name}
                </span>
                <span className="tabular shrink-0 text-right leading-tight">
                  <span className="block text-[13px] font-medium text-ink">
                    {shareLabel(item.shareBasisPoints)}
                  </span>
                  <span className="block text-[11px] text-muted">
                    {money(item.cents, { currency })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

// ── Recent transactions ──────────────────────────────────────────────────

export function RecentTransactionsPanel({ data }: { data: DashboardResponse | undefined }) {
  const today = data ? parseISO(data.today) : new Date();
  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="recent-title">
      <PanelHeader
        id="recent-title"
        title="Recent transactions"
        actions={<ViewAll to="/transactions" />}
      />
      <div className="mt-3">
        {!data ? (
          <LedgerSkeleton />
        ) : data.recent.length === 0 ? (
          <p className="rounded-control bg-sunken px-4 py-6 text-center text-[13px] text-muted">
            No transactions recorded yet.
          </p>
        ) : (
          <ul aria-label="Latest transactions">
            {data.recent.map((t) => (
              <LedgerRow
                key={t.id}
                icon={<TypeIcon type={t.type} />}
                title={t.description}
                subtitle={t.category}
                amount={
                  <Amount cents={t.amountCents} type={entryType(t.type)} currency={data.currency} />
                }
                meta={relativeDay(t.date, today)}
              />
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
