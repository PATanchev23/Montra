import { isoShiftMonth, type BudgetLine, type BudgetMonthResponse } from '@montra/shared';
import { ChevronLeft, ChevronRight, PencilLine } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useBudgets } from '../../api/finance';
import { DonutChart } from '../../components/charts/DonutChart';
import { Sparkline } from '../../components/charts/Sparkline';
import { CapsuleProgress } from '../../components/finance/CapsuleProgress';
import { rankFills, rankSwatches } from '../../components/finance/categoryVisuals';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel, PanelHeader } from '../../components/ui/Panel';
import { Select } from '../../components/ui/Select';
import { ErrorState, Skeleton } from '../../components/ui/States';
import { Tooltip } from '../../components/ui/Tooltip';
import { messagesFor, useMessages } from '../../i18n';
import { common } from '../../i18n/common';
import { cn } from '../../lib/cn';
import { count, formatDate, money, percent } from '../../lib/format';
import { useOpenCount, useStayMounted } from '../../lib/presence';
import { useCurrentMembership } from '../auth/currentUser';
import { BudgetEditorSheet } from './BudgetEditorSheet';
import { budgetMessages } from './messages';

type SortKey = 'usage' | 'amount' | 'name';
type Month = BudgetMonthResponse;
/** How far back the month picker goes. */
const MONTHS_BACK = 11;

const monthLabel = (month: string) => formatDate(`${month}-01`, 'LLLL yyyy');

function status(line: BudgetLine, currency: string) {
  const m = messagesFor(budgetMessages).status;
  const ratio = line.spentCents / line.limitCents;
  if (ratio > 1)
    return {
      tone: 'negative' as const,
      label: m.overBy(money(line.spentCents - line.limitCents, { decimals: 0, currency })),
    };
  if (line.fixed) return { tone: 'neutral' as const, label: ratio >= 0.98 ? m.paid : m.fixed };
  if (ratio >= 0.9) return { tone: 'warning' as const, label: m.nearLimit };
  if (line.spentCents > line.paceCents * 1.1 && line.paceCents < line.limitCents)
    return { tone: 'warning' as const, label: m.ahead };
  return { tone: 'neutral' as const, label: m.onTrack };
}

export function BudgetsPage() {
  const { business, role } = useCurrentMembership();
  const [month, setMonth] = useState<string | undefined>(undefined);
  const [sort, setSort] = useState<SortKey>('usage');
  const [editing, setEditing] = useState(false);
  const editorMounted = useStayMounted(editing);
  const editorKey = useOpenCount(editing);
  const { data, isError, isPlaceholderData, refetch } = useBudgets(business.id, month);
  const canEdit = role === 'OWNER';
  const m = useMessages(budgetMessages).page;

  const current = data?.today.slice(0, 7);
  const earliest = current ? isoShiftMonth(`${current}-01`, -MONTHS_BACK).slice(0, 7) : undefined;
  const step = (by: number) => data && setMonth(isoShiftMonth(`${data.month}-01`, by).slice(0, 7));

  const lines = useMemo(() => {
    if (!data) return [];
    const copy = [...data.lines];
    if (sort === 'usage')
      copy.sort((a, b) => b.spentCents / b.limitCents - a.spentCents / a.limitCents);
    if (sort === 'amount') copy.sort((a, b) => b.spentCents - a.spentCents);
    if (sort === 'name')
      copy.sort((a, b) => a.category.localeCompare(b.category, document.documentElement.lang));
    return copy;
  }, [data, sort]);

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow={m.eyebrow}
        title={m.title}
        description={data ? m.descriptionFor(monthLabel(data.month)) : m.description}
        actions={
          <>
            <div className="flex items-center gap-1 rounded-control border border-line bg-surface p-1">
              <IconButton
                label={m.previous}
                size="sm"
                disabled={!data || data.month <= earliest!}
                onClick={() => step(-1)}
              >
                <ChevronLeft />
              </IconButton>
              <span className="tabular min-w-28 text-center text-[13px] font-medium text-ink">
                {data ? monthLabel(data.month) : '…'}
              </span>
              <IconButton
                label={m.next}
                size="sm"
                disabled={!data || data.isCurrent}
                onClick={() => step(1)}
              >
                <ChevronRight />
              </IconButton>
            </div>
            {canEdit && (
              <Button variant="primary" disabled={!data} onClick={() => setEditing(true)}>
                <PencilLine />
                {m.edit}
              </Button>
            )}
          </>
        }
      />

      {isError ? (
        <Panel>
          <ErrorState title={m.loadError} onRetry={() => refetch()} />
        </Panel>
      ) : (
        <div
          className={cn(
            'flex flex-col gap-6 transition-opacity',
            isPlaceholderData && 'opacity-60',
          )}
        >
          <BudgetSummary month={data} />
          {/* This month has nothing yet, but earlier ones do: say why the bars are empty. */}
          {data?.isCurrent &&
            data.totalSpentCents === 0 &&
            data.latestExpenseMonth !== null &&
            data.latestExpenseMonth < data.month && (
              <Panel className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
                <p className="max-w-3xl text-body-sm text-ink-2">
                  {m.nothingYet(monthLabel(data.month), monthLabel(data.latestExpenseMonth))}
                </p>
                {data.latestExpenseMonth >= earliest! && (
                  <Button size="sm" onClick={() => setMonth(data.latestExpenseMonth!)}>
                    {m.showMonth(monthLabel(data.latestExpenseMonth))}
                  </Button>
                )}
              </Panel>
            )}
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Panel className="overflow-hidden" aria-labelledby="budget-categories">
              <div className="px-5 pt-5 pb-3 sm:px-6">
                <PanelHeader
                  id="budget-categories"
                  title={m.categories}
                  description={m.categoriesHint}
                  actions={
                    <Select
                      label={m.sort}
                      size="sm"
                      value={sort}
                      onChange={setSort}
                      className="w-auto min-w-[132px]"
                      options={[
                        { value: 'usage', label: m.byUsage },
                        { value: 'amount', label: m.byAmount },
                        { value: 'name', label: m.byName },
                      ]}
                    />
                  }
                />
              </div>
              {!data ? (
                <div className="space-y-px">
                  {Array.from({ length: 6 }, (_, i) => (
                    <Skeleton key={i} className="mx-6 my-5 h-8" />
                  ))}
                </div>
              ) : (
                <ul>
                  {lines.length === 0 && (
                    <li className="flex flex-col items-center gap-3 border-t border-line-soft px-5 py-8 text-center sm:px-6">
                      <p className="text-[14px] text-ink">{m.noBudgets}</p>
                      <p className="max-w-sm text-[13px] text-muted">
                        {canEdit ? m.noBudgetsOwner : m.noBudgetsViewer}
                      </p>
                      {canEdit && (
                        <Button size="sm" onClick={() => setEditing(true)}>
                          <PencilLine />
                          {m.setBudgets}
                        </Button>
                      )}
                    </li>
                  )}
                  {lines.map((line) => (
                    <BudgetRow
                      key={line.category}
                      line={line}
                      isCurrent={data.isCurrent}
                      currency={data.currency}
                    />
                  ))}
                </ul>
              )}
            </Panel>
            <SpendShare month={data} />
          </div>
        </div>
      )}

      {editorMounted && data && (
        <BudgetEditorSheet
          key={editorKey}
          businessId={business.id}
          data={data}
          open={editing}
          onOpenChange={setEditing}
        />
      )}
    </div>
  );
}

function BudgetSummary({ month }: { month: Month | undefined }) {
  const m = useMessages(budgetMessages).summary;
  const page = useMessages(budgetMessages).page;
  const noDataYet = useMessages(common).delta.noData;
  if (!month) {
    return (
      <Panel className="p-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-3 h-9 w-64" />
        <Skeleton className="mt-6 h-3.5 w-full rounded-full" />
      </Panel>
    );
  }
  const fmt = (cents: number) => money(cents, { decimals: 0, currency: month.currency });
  const noBudgets = month.lines.length === 0;
  const elapsedRatio = month.daysElapsed / month.daysInMonth;
  const daysLeft = month.daysInMonth - month.daysElapsed;
  const remaining = month.totalLimitCents - month.totalSpentCents;
  const pace = Math.round(month.totalLimitCents * elapsedRatio);
  const daily = daysLeft > 0 ? Math.max(0, remaining) / daysLeft : 0;
  const ahead = month.totalSpentCents - pace;

  const stats = [
    {
      label: m.remaining,
      value: fmt(remaining),
      tone: remaining < 0 ? 'text-negative' : 'text-ink',
    },
    month.isCurrent
      ? { label: m.dailyAllowance, value: fmt(daily), tone: 'text-ink' }
      : {
          label: m.used,
          // No limits set means no share to speak of, never NaN%.
          value:
            month.totalLimitCents > 0
              ? percent(month.totalSpentCents / month.totalLimitCents)
              : noDataYet,
          tone: month.totalLimitCents > 0 ? 'text-ink' : 'text-muted text-[14px] font-normal',
        },
    month.isCurrent
      ? { label: m.daysLeft, value: count(daysLeft), tone: 'text-ink' }
      : {
          label: m.categoriesOver,
          value: count(month.lines.filter((l) => l.spentCents > l.limitCents).length),
          tone: 'text-ink',
        },
  ];

  return (
    <Panel className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-12">
      <div className="min-w-0">
        <p className="text-[13px] text-muted">{month.isCurrent ? m.spentSoFar : m.spent}</p>
        <p className="tabular mt-1 text-[30px] leading-tight font-semibold tracking-[-0.03em] text-ink">
          {fmt(month.totalSpentCents)}
          <span className="text-[16px] font-normal tracking-normal text-muted">
            {' '}
            {noBudgets ? `· ${page.noBudgets}` : m.of(fmt(month.totalLimitCents))}
          </span>
        </p>
        <div className="mt-5">
          <CapsuleProgress
            size="lg"
            label={m.totalUsed}
            value={month.totalSpentCents}
            max={month.totalLimitCents}
            pace={month.isCurrent && !noBudgets ? pace : undefined}
          />
        </div>
        {noBudgets ? (
          <p className="mt-3 text-[13px] text-muted">{noDataYet}</p>
        ) : (
          month.isCurrent && (
            <p className="tabular mt-3 text-[13px] text-muted">
              {ahead > 0 ? (
                <>
                  <span className="text-warning">{m.ahead(fmt(ahead))}</span> {m.aheadRest}
                </>
              ) : (
                <>
                  <span className="text-positive">{m.below(fmt(-ahead))}</span> {m.belowRest}
                </>
              )}
            </p>
          )
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

function BudgetRow({
  line,
  isCurrent,
  currency,
}: {
  line: BudgetLine;
  isCurrent: boolean;
  currency: string;
}) {
  const s = status(line, currency);
  const remaining = line.limitCents - line.spentCents;
  const m = useMessages(budgetMessages).row;
  const fmt = (cents: number) => money(cents, { decimals: 0, currency });
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-3 border-t border-line-soft px-5 py-4 sm:px-6 md:grid-cols-[minmax(160px,1.1fr)_minmax(0,2fr)_auto]">
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[14px] font-medium text-ink">{line.category}</p>
        <div className="mt-1">
          <Badge tone={s.tone} className={s.tone === 'neutral' ? 'text-muted' : undefined}>
            {s.label}
          </Badge>
        </div>
      </div>
      <div className="col-span-2 row-start-2 flex items-center gap-4 md:col-span-1 md:row-start-auto">
        <div className="flex-1">
          <CapsuleProgress
            label={m.used(line.category)}
            value={line.spentCents}
            max={line.limitCents}
            pace={isCurrent && !line.fixed ? line.paceCents : undefined}
            tone={line.fixed && line.spentCents <= line.limitCents ? 'accent' : undefined}
          />
        </div>
        <Tooltip content={m.history}>
          <span className="hidden sm:block">
            <Sparkline values={line.history} tone="neutral" width={56} height={22} />
          </span>
        </Tooltip>
      </div>
      <div className="tabular row-start-1 text-right leading-tight md:row-start-auto md:min-w-32">
        <p className="text-[14px] text-ink">
          {fmt(line.spentCents)}
          <span className="text-muted"> / {fmt(line.limitCents)}</span>
        </p>
        <p className={cn('mt-1 text-[12px]', remaining < 0 ? 'text-negative' : 'text-muted')}>
          {remaining < 0 ? m.over(fmt(-remaining)) : m.left(fmt(remaining))}
        </p>
      </div>
    </li>
  );
}

function SpendShare({ month }: { month: Month | undefined }) {
  const [active, setActive] = useState<string | null>(null);
  const m = useMessages(budgetMessages).share;
  const page = useMessages(budgetMessages).page;
  const items = useMemo(() => {
    if (!month) return [];
    const sorted = [...month.lines].sort((a, b) => b.spentCents - a.spentCents);
    const top = sorted.slice(0, 4);
    const rest = sorted.slice(4).reduce((s, l) => s + l.spentCents, 0);
    return [
      ...top.map((l) => ({ id: l.category, value: l.spentCents })),
      ...(rest > 0 ? [{ id: m.other, value: rest }] : []),
    ];
  }, [month, m.other]);
  const total = items.reduce((s, i) => s + i.value, 0);
  const activeItem = items.find((i) => i.id === active);
  const fmt = (cents: number) => money(cents, { decimals: 0, currency: month?.currency });

  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="spend-share">
      <PanelHeader id="spend-share" title={m.title} description={m.description} />
      {month && total === 0 ? (
        // Nothing spent: an empty ring and no legend, rather than a donut of zeros.
        <div className="mt-6 flex flex-col items-center gap-4">
          <div aria-hidden className="size-44 rounded-full border-20 border-chart-track" />
          <p className="text-body text-muted">{page.noSpending}</p>
        </div>
      ) : month ? (
        <>
          <div className="mt-6 flex justify-center">
            <DonutChart
              ariaLabel={m.chart}
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
                    {fmt(activeItem?.value ?? total)}
                  </span>
                  <span className="text-[12px] text-muted">{activeItem?.id ?? m.spent}</span>
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
                <span className="flex-1 truncate text-ink-2">{item.id}</span>
                <span className="tabular text-muted">{fmt(item.value)}</span>
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
