import { ChevronLeft, ChevronRight, PencilLine } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useBudgets } from '../../api/finance';
import { DonutChart } from '../../components/charts/DonutChart';
import { Sparkline } from '../../components/charts/Sparkline';
import { CapsuleProgress } from '../../components/finance/CapsuleProgress';
import { CategoryIcon } from '../../components/finance/CategoryIcon';
import { rankFills, rankSwatches } from '../../components/finance/categoryVisuals';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel, PanelHeader } from '../../components/ui/Panel';
import { Select } from '../../components/ui/Select';
import { ErrorState, Skeleton } from '../../components/ui/States';
import { Tooltip } from '../../components/ui/Tooltip';
import type { BudgetLine, BudgetMonth } from '../../demo/types';
import { cn } from '../../lib/cn';
import { money, percent } from '../../lib/format';

type SortKey = 'usage' | 'amount' | 'name';
const MIN_OFFSET = -11;

/** Costs that are known in advance; reaching their limit is expected, not a warning. */
const FIXED: BudgetLine['categoryId'][] = ['payroll', 'rent', 'software', 'utilities'];

function status(line: BudgetLine) {
  const ratio = line.spentCents / line.limitCents;
  if (ratio > 1)
    return {
      tone: 'negative' as const,
      label: `Over by ${money(line.spentCents - line.limitCents, { decimals: 0 })}`,
    };
  if (FIXED.includes(line.categoryId))
    return { tone: 'neutral' as const, label: ratio >= 0.98 ? 'Paid' : 'Fixed cost' };
  if (ratio >= 0.9) return { tone: 'warning' as const, label: 'Near limit' };
  if (line.spentCents > line.paceCents * 1.1 && line.paceCents < line.limitCents)
    return { tone: 'warning' as const, label: 'Ahead of pace' };
  return { tone: 'neutral' as const, label: 'On track' };
}

export function BudgetsPage() {
  const [offset, setOffset] = useState(0);
  const [sort, setSort] = useState<SortKey>('usage');
  const { data, isPending, isError, isPlaceholderData, refetch } = useBudgets(offset);

  const lines = useMemo(() => {
    if (!data) return [];
    const copy = [...data.lines];
    if (sort === 'usage')
      copy.sort((a, b) => b.spentCents / b.limitCents - a.spentCents / a.limitCents);
    if (sort === 'amount') copy.sort((a, b) => b.spentCents - a.spentCents);
    if (sort === 'name') copy.sort((a, b) => a.name.localeCompare(b.name));
    return copy;
  }, [data, sort]);

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Planning"
        title="Budgets"
        description={
          data
            ? `Monthly spending limits · ${data.label} ${data.key.slice(0, 4)}`
            : 'Monthly spending limits'
        }
        actions={
          <>
            <div className="flex items-center gap-1 rounded-control border border-line bg-surface p-1">
              <IconButton
                label="Previous month"
                size="sm"
                disabled={offset <= MIN_OFFSET}
                onClick={() => setOffset((o) => o - 1)}
              >
                <ChevronLeft />
              </IconButton>
              <span className="tabular min-w-28 text-center text-[13px] font-medium text-ink">
                {data ? `${data.label} ${data.key.slice(0, 4)}` : '…'}
              </span>
              <IconButton
                label="Next month"
                size="sm"
                disabled={offset >= 0}
                onClick={() => setOffset((o) => o + 1)}
              >
                <ChevronRight />
              </IconButton>
            </div>
            <Tooltip content="Changing limits arrives with the budgets API.">
              <span tabIndex={0} className="rounded-control">
                <Button variant="primary" disabled className="pointer-events-none">
                  <PencilLine />
                  Edit budgets
                </Button>
              </span>
            </Tooltip>
          </>
        }
      />

      {isError ? (
        <Panel>
          <ErrorState title="Could not load budgets" onRetry={() => refetch()} />
        </Panel>
      ) : (
        <div
          className={cn(
            'flex flex-col gap-6 transition-opacity',
            isPlaceholderData && 'opacity-60',
          )}
        >
          <BudgetSummary month={data} />
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Panel className="overflow-hidden" aria-labelledby="budget-categories">
              <div className="px-5 pt-5 pb-3 sm:px-6">
                <PanelHeader
                  id="budget-categories"
                  title="Categories"
                  description="The marker on each bar shows where spending would be if spread evenly."
                  actions={
                    <Select
                      label="Sort categories"
                      size="sm"
                      value={sort}
                      onChange={setSort}
                      className="w-[132px]"
                      options={[
                        { value: 'usage', label: 'By usage' },
                        { value: 'amount', label: 'By amount' },
                        { value: 'name', label: 'A–Z' },
                      ]}
                    />
                  }
                />
              </div>
              {isPending ? (
                <div className="space-y-px">
                  {Array.from({ length: 6 }, (_, i) => (
                    <Skeleton key={i} className="mx-6 my-5 h-8" />
                  ))}
                </div>
              ) : (
                <ul>
                  {lines.map((line) => (
                    <BudgetRow key={line.categoryId} line={line} isCurrent={data.isCurrent} />
                  ))}
                </ul>
              )}
            </Panel>
            <SpendShare month={data} />
          </div>
        </div>
      )}
    </div>
  );
}

function BudgetSummary({ month }: { month: BudgetMonth | undefined }) {
  if (!month) {
    return (
      <Panel className="p-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-3 h-9 w-64" />
        <Skeleton className="mt-6 h-3.5 w-full rounded-full" />
      </Panel>
    );
  }
  const remaining = month.totalLimitCents - month.totalSpentCents;
  const pace = Math.round(month.totalLimitCents * month.elapsedRatio);
  const daily = month.daysLeft > 0 ? Math.max(0, remaining) / month.daysLeft : 0;
  const ahead = month.totalSpentCents - pace;

  const stats = [
    {
      label: 'Remaining',
      value: money(remaining, { decimals: 0 }),
      tone: remaining < 0 ? 'text-negative' : 'text-ink',
    },
    month.isCurrent
      ? { label: 'Daily allowance', value: money(daily, { decimals: 0 }), tone: 'text-ink' }
      : {
          label: 'Used',
          value: percent(month.totalSpentCents / month.totalLimitCents),
          tone: 'text-ink',
        },
    month.isCurrent
      ? { label: 'Days left', value: String(month.daysLeft), tone: 'text-ink' }
      : {
          label: 'Categories over',
          value: String(month.lines.filter((l) => l.spentCents > l.limitCents).length),
          tone: 'text-ink',
        },
  ];

  return (
    <Panel className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-12">
      <div className="min-w-0">
        <p className="text-[13px] text-muted">{month.isCurrent ? 'Spent so far' : 'Spent'}</p>
        <p className="tabular mt-1 text-[30px] leading-tight font-semibold tracking-[-0.03em] text-ink">
          {money(month.totalSpentCents, { decimals: 0 })}
          <span className="text-[16px] font-normal tracking-normal text-muted">
            {' '}
            of {money(month.totalLimitCents, { decimals: 0 })}
          </span>
        </p>
        <div className="mt-5">
          <CapsuleProgress
            size="lg"
            label="Total budget used"
            value={month.totalSpentCents}
            max={month.totalLimitCents}
            pace={month.isCurrent ? pace : undefined}
          />
        </div>
        {month.isCurrent && (
          <p className="tabular mt-3 text-[13px] text-muted">
            {ahead > 0 ? (
              <>
                <span className="text-warning">{money(ahead, { decimals: 0 })} ahead</span> of an
                even pace for this point in the month
              </>
            ) : (
              <>
                <span className="text-positive">{money(-ahead, { decimals: 0 })} below</span> an
                even pace for this point in the month
              </>
            )}
          </p>
        )}
      </div>
      <dl className="grid grid-cols-3 divide-x divide-line rounded-control border border-line bg-sunken">
        {stats.map((s) => (
          <div key={s.label} className="px-5 py-3.5 sm:min-w-36">
            <dt className="text-[12px] text-muted">{s.label}</dt>
            <dd className={cn('tabular mt-1 text-[18px] font-semibold tracking-[-0.01em]', s.tone)}>
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function BudgetRow({ line, isCurrent }: { line: BudgetLine; isCurrent: boolean }) {
  const s = status(line);
  const remaining = line.limitCents - line.spentCents;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-3 border-t border-line-soft px-5 py-4 sm:px-6 md:grid-cols-[minmax(160px,1.1fr)_minmax(0,2fr)_auto]">
      <div className="flex min-w-0 items-center gap-3">
        <CategoryIcon categoryId={line.categoryId} size="sm" />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[14px] font-medium text-ink">{line.name}</p>
          <div className="mt-1">
            <Badge tone={s.tone} className={s.tone === 'neutral' ? 'text-muted' : undefined}>
              {s.label}
            </Badge>
          </div>
        </div>
      </div>
      <div className="col-span-2 row-start-2 flex items-center gap-4 md:col-span-1 md:row-start-auto">
        <div className="flex-1">
          <CapsuleProgress
            label={`${line.name} budget used`}
            value={line.spentCents}
            max={line.limitCents}
            pace={isCurrent && !FIXED.includes(line.categoryId) ? line.paceCents : undefined}
            tone={
              FIXED.includes(line.categoryId) && line.spentCents <= line.limitCents
                ? 'accent'
                : undefined
            }
          />
        </div>
        <Tooltip content="Spending over the last 6 months">
          <span className="hidden sm:block">
            <Sparkline values={line.history} tone="neutral" width={56} height={22} />
          </span>
        </Tooltip>
      </div>
      <div className="tabular row-start-1 text-right leading-tight md:row-start-auto md:min-w-32">
        <p className="text-[14px] text-ink">
          {money(line.spentCents, { decimals: 0 })}
          <span className="text-muted"> / {money(line.limitCents, { decimals: 0 })}</span>
        </p>
        <p className={cn('mt-1 text-[12px]', remaining < 0 ? 'text-negative' : 'text-muted')}>
          {remaining < 0
            ? `${money(-remaining, { decimals: 0 })} over`
            : `${money(remaining, { decimals: 0 })} left`}
        </p>
      </div>
    </li>
  );
}

function SpendShare({ month }: { month: BudgetMonth | undefined }) {
  const [active, setActive] = useState<string | null>(null);
  const items = useMemo(() => {
    if (!month) return [];
    const sorted = [...month.lines].sort((a, b) => b.spentCents - a.spentCents);
    const top = sorted.slice(0, 4);
    const rest = sorted.slice(4).reduce((s, l) => s + l.spentCents, 0);
    return [...top.map((l) => ({ id: l.name, value: l.spentCents })), { id: 'Other', value: rest }];
  }, [month]);
  const total = items.reduce((s, i) => s + i.value, 0);
  const activeItem = items.find((i) => i.id === active);

  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="spend-share">
      <PanelHeader
        id="spend-share"
        title="Where it went"
        description="Share of budgeted spending"
      />
      {month ? (
        <>
          <div className="mt-6 flex justify-center">
            <DonutChart
              ariaLabel="Share of budgeted spending by category"
              size={176}
              thickness={20}
              active={active}
              onActiveChange={setActive}
              items={items.map((item, i) => ({
                id: item.id,
                label: item.id,
                value: item.value,
                fill: rankFills[i] ?? 'fill-chart-2',
              }))}
              center={
                <>
                  <span className="tabular text-[20px] font-semibold tracking-[-0.02em] text-ink">
                    {money(activeItem?.value ?? total, { decimals: 0 })}
                  </span>
                  <span className="text-[12px] text-muted">{activeItem?.id ?? 'Spent'}</span>
                </>
              }
            />
          </div>
          <ul className="mt-6 space-y-2.5">
            {items.map((item, i) => (
              <li
                key={item.id}
                onMouseEnter={() => setActive(item.id)}
                onMouseLeave={() => setActive(null)}
                className={cn(
                  'flex items-center gap-2.5 text-[13px] transition-opacity',
                  active && active !== item.id && 'opacity-45',
                )}
              >
                <span className={cn('size-2.5 rounded-full', rankSwatches[i])} />
                <span className="flex-1 text-ink-2">{item.id}</span>
                <span className="tabular text-muted">{money(item.value, { decimals: 0 })}</span>
                <span className="tabular w-10 text-right font-medium text-ink">
                  {percent(total ? item.value / total : 0)}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <Skeleton className="mx-auto mt-6 size-44 rounded-full" />
      )}
    </Panel>
  );
}
