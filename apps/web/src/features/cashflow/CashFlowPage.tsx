import { format } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DEMO_TODAY, useCashFlow } from '../../api/finance';
import { useHasTransactions } from '../../api/transactions';
import { CapsuleBarChart } from '../../components/charts/CapsuleBarChart';
import { Legend, TooltipRow, TooltipTitle } from '../../components/charts/ChartTooltip';
import { LineChart } from '../../components/charts/LineChart';
import { Amount } from '../../components/finance/Amount';
import { CategoryIcon } from '../../components/finance/CategoryIcon';
import { EmptyChartNote } from '../../components/finance/EmptyChartNote';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel, PanelHeader } from '../../components/ui/Panel';
import { ErrorState, Skeleton } from '../../components/ui/States';
import type { CashFlowData } from '../../demo/api';
import { useMessages } from '../../i18n';
import { common } from '../../i18n/common';
import { cn } from '../../lib/cn';
import { formatDate, formatDay, money, relativeDay } from '../../lib/format';
import { useCurrentMembership } from '../auth/currentUser';
import { emptyCashFlow } from '../noData';
import { cashFlowMessages } from './messages';

/** Set for a business with no transactions: the page shows its layout empty, at zero. */
interface Empty {
  noData: boolean;
  canEdit: boolean;
}

export function CashFlowPage() {
  // The figures come from the TechStore sample layer, which must not stand in for a
  // business that has recorded nothing: that business sees the same page, at zero.
  const { business, role } = useCurrentMembership();
  const gate = useHasTransactions(business.id);
  const noData = gate.hasTransactions === false;
  const sample = useCashFlow({ enabled: gate.hasTransactions === true });
  const zero = useMemo(() => (noData ? emptyCashFlow() : undefined), [noData]);
  const data = zero ?? sample.data;
  const loading = !data;
  const empty: Empty = { noData, canEdit: role === 'OWNER' };
  const m = useMessages(cashFlowMessages).page;

  return (
    <div className="flex flex-col gap-7">
      <PageHeader eyebrow={m.eyebrow} title={m.title} description={m.description} />

      {!noData && (gate.isError || sample.isError) ? (
        <Panel>
          <ErrorState
            title={m.loadError}
            onRetry={() => (gate.isError ? gate.refetch() : sample.refetch())}
          />
        </Panel>
      ) : (
        <>
          <StatStrip stats={data?.stats} noData={noData} />
          <MonthlyComparison data={data} loading={loading} empty={empty} />
          <BalanceProjection data={data} loading={loading} empty={empty} />
          <UpcomingTable data={data} loading={loading} noData={noData} />
        </>
      )}
    </div>
  );
}

function StatStrip({
  stats,
  noData,
}: {
  stats: CashFlowData['stats'] | undefined;
  noData: boolean;
}) {
  const m = useMessages(cashFlowMessages).stats;
  const noDataYet = useMessages(common).delta.noData;
  const items = [
    {
      label: m.opening,
      hint: formatDay(
        new Date(DEMO_TODAY.getFullYear() - 1, DEMO_TODAY.getMonth(), 1),
        'd MMM yyyy',
      ),
      value: stats?.openingCents,
    },
    {
      label: m.moneyIn,
      hint: m.last12,
      value: stats?.incomeCents,
      className: 'text-positive',
      sign: 'always' as const,
    },
    {
      label: m.moneyOut,
      hint: m.last12, // 0 - x, not -x: no expenses is €0, never a negative zero ("−€0").
      value: stats ? 0 - stats.expenseCents : undefined,
    },
    { label: m.today, hint: formatDay(DEMO_TODAY, 'd MMM yyyy'), value: stats?.closingCents },
    {
      label: m.projected,
      hint: m.in90,
      value: stats?.projectedCents,
      className: 'text-chart-1',
    },
  ];
  return (
    <Panel className="grid grid-cols-2 gap-px overflow-hidden bg-line lg:grid-cols-5">
      {items.map((item) => (
        <div
          key={item.label}
          className="min-w-0 bg-surface px-5 py-4 last:col-span-2 lg:last:col-span-1"
        >
          <p className="truncate text-[13px] text-muted">{item.label}</p>
          {item.value === undefined ? (
            <Skeleton className="mt-2 h-6 w-24" />
          ) : (
            <p
              className={cn(
                'tabular mt-1 truncate text-[20px] font-semibold tracking-[-0.02em] text-ink',
                !noData && item.className,
              )}
            >
              {money(item.value, { decimals: 0, sign: item.sign ?? 'auto' })}
            </p>
          )}
          {/* With nothing recorded, the sample's dates and spans mean nothing: say so instead. */}
          <p className={cn('mt-0.5 truncate text-[12px]', noData ? 'text-muted' : 'text-faint')}>
            {noData ? noDataYet : item.hint}
          </p>
        </div>
      ))}
    </Panel>
  );
}

function MonthlyComparison({
  data,
  loading,
  empty,
}: {
  data: CashFlowData | undefined;
  loading: boolean;
  empty: Empty;
}) {
  const t = useMessages(cashFlowMessages).monthly;
  const page = useMessages(cashFlowMessages).page;
  const none = useMessages(common).noTransactions.title;
  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="monthly-comparison">
      <PanelHeader
        id="monthly-comparison"
        title={t.title}
        description={empty.noData ? none : t.description}
        actions={
          <Legend
            items={[
              { label: t.income, swatch: 'bg-chart-1' },
              { label: t.expenses, swatch: 'bg-chart-2' },
              { label: t.projected, swatch: 'border-chart-1', dashed: true },
            ]}
          />
        }
      />
      <div className="relative mt-6">
        {loading || !data ? (
          <Skeleton className="h-[300px] w-full" />
        ) : (
          <>
            <div className={empty.noData ? 'opacity-40' : undefined}>
              <CapsuleBarChart
                layout="grouped"
                height={300}
                ariaLabel={t.chart}
                categories={data.months.map((m) => ({
                  key: m.key,
                  label: m.label,
                  projected: m.projected,
                }))}
                series={[
                  {
                    id: 'income',
                    label: t.income,
                    tone: 'primary',
                    values: data.months.map((m) => m.incomeCents),
                  },
                  {
                    id: 'expenses',
                    label: t.expenses,
                    tone: 'secondary',
                    values: data.months.map((m) => m.expenseCents),
                  },
                ]}
                renderTooltip={(i) => {
                  const m = data.months[i]!;
                  return (
                    <>
                      <TooltipTitle>
                        {formatDate(`${m.key}-01`, 'LLLL yyyy')}
                        {m.projected && (
                          <span className="font-normal text-chart-1">{t.projectedSuffix}</span>
                        )}
                      </TooltipTitle>
                      <TooltipRow
                        swatch="bg-chart-1"
                        label={t.income}
                        value={money(m.incomeCents, { decimals: 0 })}
                      />
                      <TooltipRow
                        swatch="bg-chart-2"
                        label={t.expenses}
                        value={money(m.expenseCents, { decimals: 0 })}
                      />
                      <div className="mt-1.5 border-t border-line pt-1.5">
                        <TooltipRow
                          label={t.net}
                          value={money(m.netCents, { decimals: 0, sign: 'always' })}
                          emphasis
                        />
                      </div>
                    </>
                  );
                }}
              />
            </div>
            {empty.noData && <EmptyChartNote canEdit={empty.canEdit} ownerText={page.chartOwner} />}
          </>
        )}
      </div>
    </Panel>
  );
}

function BalanceProjection({
  data,
  loading,
  empty,
}: {
  data: CashFlowData | undefined;
  loading: boolean;
  empty: Empty;
}) {
  const todayIso = format(DEMO_TODAY, 'yyyy-MM-dd');
  const t = useMessages(cashFlowMessages).balance;
  const page = useMessages(cashFlowMessages).page;
  const projectedSuffix = useMessages(cashFlowMessages).monthly.projectedSuffix;
  const c = useMessages(common);
  const { noData } = empty;
  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="balance-projection">
      <PanelHeader
        id="balance-projection"
        title={t.title}
        description={noData ? c.noTransactions.title : t.description}
        actions={
          <Legend
            items={[
              { label: t.balance, swatch: 'bg-chart-1' },
              { label: t.projection, swatch: 'border-chart-1', dashed: true },
              { label: t.range, swatch: 'bg-chart-1/25' },
            ]}
          />
        }
      />
      <div className="relative mt-6">
        {loading || !data ? (
          <Skeleton className="h-[280px] w-full" />
        ) : (
          <>
            <div className={noData ? 'opacity-40' : undefined}>
              <LineChart
                height={280}
                ariaLabel={t.chart}
                series={[
                  {
                    id: 'balance',
                    label: t.balance,
                    tone: 'primary',
                    area: true,
                    points: data.balance.map((p) => ({
                      date: p.date,
                      value: p.balanceCents,
                      projected: p.projected,
                    })),
                  },
                ]}
                band={data.balance
                  .filter((p) => p.projected && p.lowCents !== undefined)
                  .map((p) => ({ date: p.date, low: p.lowCents!, high: p.highCents! }))}
                // The marker and the buffer belong to the sample's calendar and settings.
                markers={noData ? [] : [{ date: todayIso, label: t.today }]}
                threshold={
                  noData
                    ? undefined
                    : {
                        value: data.thresholdCents,
                        label: t.buffer(money(data.thresholdCents, { decimals: 0 })),
                      }
                }
                renderTooltip={(date) => {
                  const p = data.balance.find((b) => b.date === date)!;
                  return (
                    <>
                      <TooltipTitle>
                        {formatDate(date, 'EEE, d MMM yyyy')}
                        {p.projected && (
                          <span className="font-normal text-chart-1">{projectedSuffix}</span>
                        )}
                      </TooltipTitle>
                      <TooltipRow
                        swatch="bg-chart-1"
                        label={t.balance}
                        value={money(p.balanceCents, { decimals: 0 })}
                        emphasis
                      />
                      {p.projected && p.lowCents !== undefined && (
                        <TooltipRow
                          label={t.range}
                          value={`${money(p.lowCents, { decimals: 0 })} – ${money(p.highCents!, { decimals: 0 })}`}
                        />
                      )}
                    </>
                  );
                }}
              />
            </div>
            {noData && (
              <EmptyChartNote
                canEdit={empty.canEdit}
                ownerText={page.balanceOwner}
                withImport={false}
              />
            )}
          </>
        )}
      </div>
      {data && (
        <dl className="mt-6 grid gap-4 border-t border-line pt-5 text-[13px] sm:grid-cols-3">
          <div>
            <dt className="text-muted">{t.lowest}</dt>
            <dd className="tabular mt-0.5 text-[15px] font-medium text-ink">
              {noData ? (
                <span className="font-normal text-muted">{c.delta.noData}</span>
              ) : (
                <>
                  {money(data.stats.lowestCents, { decimals: 0 })}{' '}
                  <span className="font-normal text-muted">
                    {t.on(formatDate(data.stats.lowestDate, 'd MMM'))}
                  </span>
                </>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted">{t.headroom}</dt>
            <dd className="tabular mt-0.5 text-[15px] font-medium text-positive">
              {noData ? (
                <span className="font-normal text-muted">{c.delta.noData}</span>
              ) : (
                money(data.stats.lowestCents - data.thresholdCents, { decimals: 0 })
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted">{t.change}</dt>
            <dd className="tabular mt-0.5 text-[15px] font-medium text-ink">
              {noData ? (
                <span className="font-normal text-muted">{c.delta.noData}</span>
              ) : (
                money(data.stats.projectedCents - data.stats.closingCents, {
                  decimals: 0,
                  sign: 'always',
                })
              )}
            </dd>
          </div>
        </dl>
      )}
    </Panel>
  );
}

const COLLAPSED_ROWS = 10;

function UpcomingTable({
  data,
  loading,
  noData,
}: {
  data: CashFlowData | undefined;
  loading: boolean;
  noData: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const t = useMessages(cashFlowMessages).upcoming;
  const page = useMessages(cashFlowMessages).page;
  const rows = data ? (expanded ? data.upcoming : data.upcoming.slice(0, COLLAPSED_ROWS)) : [];
  const inflow =
    data?.upcoming.filter((u) => u.type === 'income').reduce((s, u) => s + u.amountCents, 0) ?? 0;
  const outflow =
    data?.upcoming.filter((u) => u.type === 'expense').reduce((s, u) => s + u.amountCents, 0) ?? 0;

  return (
    <Panel id="upcoming" className="scroll-mt-6 overflow-hidden" aria-labelledby="upcoming-heading">
      <div className="px-5 pt-5 pb-4 sm:px-6">
        <PanelHeader
          id="upcoming-heading"
          title={t.title}
          description={t.description}
          actions={
            data && (
              <div className="tabular flex gap-4 text-[13px]">
                <span className="text-muted">
                  {t.in}{' '}
                  <span className={cn('font-medium', noData ? 'text-ink' : 'text-positive')}>
                    {money(inflow, { decimals: 0 })}
                  </span>
                </span>
                <span className="text-muted">
                  {t.out}{' '}
                  <span className="font-medium text-ink">{money(outflow, { decimals: 0 })}</span>
                </span>
              </div>
            )
          }
        />
      </div>
      {loading || !data ? (
        <div className="space-y-3 px-6 pb-6">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-t border-line text-left text-[11px] tracking-[0.08em] text-muted uppercase">
                  <th scope="col" className="h-10 pr-3 pl-5 font-medium sm:pl-6">
                    {t.due}
                  </th>
                  <th scope="col" className="px-3 font-medium">
                    {t.item}
                  </th>
                  <th scope="col" className="hidden px-3 font-medium md:table-cell">
                    {t.basis}
                  </th>
                  <th scope="col" className="px-3 text-right font-medium">
                    {t.amount}
                  </th>
                  <th
                    scope="col"
                    className="hidden pr-5 pl-3 text-right font-medium sm:table-cell sm:pr-6"
                  >
                    {t.after}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr className="border-t border-line-soft">
                    <td
                      colSpan={5}
                      className="px-5 py-8 text-center text-[13px] text-muted sm:px-6"
                    >
                      {page.noUpcoming}
                    </td>
                  </tr>
                )}
                {rows.map((u) => (
                  <tr key={u.id} className="border-t border-line-soft hover:bg-hover/60">
                    <td className="tabular py-3 pr-3 pl-5 whitespace-nowrap text-ink-2 sm:pl-6">
                      {relativeDay(u.dueDate, DEMO_TODAY, 'EEE d MMM')}
                    </td>
                    <td className="w-full max-w-0 px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <CategoryIcon categoryId={u.categoryId} size="sm" />
                        <div className="min-w-0 leading-tight">
                          <p className="truncate text-[14px] text-ink">{u.description}</p>
                          <p className="mt-1 truncate text-[12px] text-muted">{u.detail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-3 md:table-cell">
                      {u.certainty === 'scheduled' ? (
                        <Badge tone="accent">{t.scheduled}</Badge>
                      ) : (
                        <Badge>{t.estimated}</Badge>
                      )}
                    </td>
                    <td className="px-3 text-right text-[14px]">
                      <Amount cents={u.amountCents} type={u.type} quietExpense />
                    </td>
                    <td className="tabular hidden pr-5 pl-3 text-right text-muted sm:table-cell sm:pr-6">
                      {money(u.balanceAfterCents, { decimals: 0 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.upcoming.length > COLLAPSED_ROWS && (
            <div className="border-t border-line px-5 py-3 sm:px-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded((e) => !e)}
                aria-expanded={expanded}
              >
                <ChevronDown className={cn('transition-transform', expanded && 'rotate-180')} />
                {expanded ? t.showFewer : t.showAll(data.upcoming.length)}
              </Button>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
