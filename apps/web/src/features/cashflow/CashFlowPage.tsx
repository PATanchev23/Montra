import type { CashFlowResponse } from '@montra/shared';
import { ChevronDown, Landmark } from 'lucide-react';
import { useState } from 'react';
import { useCashFlow } from '../../api/finance';
import { CapsuleBarChart } from '../../components/charts/CapsuleBarChart';
import { Legend, TooltipRow, TooltipTitle } from '../../components/charts/ChartTooltip';
import { LineChart } from '../../components/charts/LineChart';
import { Amount } from '../../components/finance/Amount';
import { EmptyChartNote } from '../../components/finance/EmptyChartNote';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel, PanelHeader } from '../../components/ui/Panel';
import { ErrorState, Skeleton } from '../../components/ui/States';
import { useMessages } from '../../i18n';
import { common } from '../../i18n/common';
import { cn } from '../../lib/cn';
import { formatDate, money, relativeDay, type MoneyOptions } from '../../lib/format';
import { useOpenCount, useStayMounted } from '../../lib/presence';
import { useCurrentMembership } from '../auth/currentUser';
import { TypeIcon } from '../transactions/TypeIcon';
import { CashSettingsDialog } from './CashSettingsDialog';
import { cashFlowMessages } from './messages';

/** Set for a business with no transactions: the page shows its layout empty, at zero. */
interface Empty {
  noData: boolean;
  canEdit: boolean;
}

type Data = CashFlowResponse;

const amount =
  (data: Data | undefined) =>
  (cents: number, options: MoneyOptions = {}) =>
    money(cents, { decimals: 0, ...options, currency: data?.currency });

export function CashFlowPage() {
  const { business, role } = useCurrentMembership();
  const { data, isError, refetch } = useCashFlow(business.id);
  const [editing, setEditing] = useState(false);
  const settingsMounted = useStayMounted(editing);
  const settingsKey = useOpenCount(editing);
  const canEdit = role === 'OWNER';
  const noData = data?.transactionCount === 0;
  const empty: Empty = { noData, canEdit };
  const m = useMessages(cashFlowMessages).page;

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow={m.eyebrow}
        title={m.title}
        description={m.description}
        actions={
          canEdit && (
            <Button onClick={() => setEditing(true)} disabled={!data}>
              <Landmark />
              {m.bankBalance}
            </Button>
          )
        }
      />

      {isError ? (
        <Panel>
          <ErrorState title={m.loadError} onRetry={() => refetch()} />
        </Panel>
      ) : (
        <>
          {data && <BalanceNote data={data} canEdit={canEdit} onEdit={() => setEditing(true)} />}
          <StatStrip data={data} noData={noData} />
          <MonthlyComparison data={data} empty={empty} />
          <BalanceProjection data={data} empty={empty} />
          <UpcomingTable data={data} />
        </>
      )}

      {settingsMounted && data && (
        <CashSettingsDialog
          key={settingsKey}
          open={editing}
          businessId={business.id}
          currency={data.currency}
          settings={data.settings}
          today={data.today}
          ledgerStart={data.ledgerStart}
          onOpenChange={setEditing}
        />
      )}
    </div>
  );
}

/** Where the balances start: the owner's bank balance, or zero until they enter it. */
function BalanceNote({
  data,
  canEdit,
  onEdit,
}: {
  data: Data;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const m = useMessages(cashFlowMessages).note;
  const { balanceCents, balanceDate } = data.settings;
  const fmt = amount(data);
  const start = data.ledgerStart;
  if (balanceCents !== null && balanceDate !== null && start !== null && start.cents < 0) {
    // The entered balance is less than the history says should be there.
    return (
      <Panel
        role="note"
        className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-warning/30 bg-warning-soft/40 px-5 py-3.5 sm:px-6"
      >
        <div className="max-w-3xl text-body-sm text-ink-2">
          <p className="font-medium text-ink">{m.mismatchTitle}</p>
          <p className="mt-1">
            {m.mismatch(
              formatDate(start.date, 'd MMM yyyy'),
              fmt(balanceCents - start.cents),
              fmt(balanceCents),
              formatDate(balanceDate, 'd MMM'),
              fmt(start.cents),
            )}{' '}
            {canEdit
              ? m.mismatchOwner(fmt(balanceCents), formatDate(start.date, 'd MMM yyyy'))
              : m.mismatchViewer}
          </p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={onEdit}>
            {m.update}
          </Button>
        )}
      </Panel>
    );
  }
  if (balanceCents !== null && balanceDate !== null) {
    return (
      <p className="-mt-3 text-[13px] text-muted">
        {m.from(fmt(balanceCents, { decimals: 2 }), formatDate(balanceDate, 'd MMM yyyy'))}
      </p>
    );
  }
  return (
    <Panel className="flex flex-wrap items-center justify-between gap-3 border-warning/30 bg-warning-soft/40 px-5 py-3.5 sm:px-6">
      <p className="text-[13px] text-ink-2">{canEdit ? m.unsetOwner : m.unsetViewer}</p>
      {canEdit && (
        <Button size="sm" variant="primary" onClick={onEdit}>
          {m.set}
        </Button>
      )}
    </Panel>
  );
}

function StatStrip({ data, noData }: { data: Data | undefined; noData: boolean }) {
  const m = useMessages(cashFlowMessages).stats;
  const noDataYet = useMessages(common).delta.noData;
  const stats = data?.stats;
  const fmt = amount(data);
  const items = [
    {
      label: m.opening,
      hint: stats ? formatDate(stats.openingDate, 'd MMM yyyy') : '',
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
    {
      label: m.today,
      hint: data ? formatDate(data.today, 'd MMM yyyy') : '',
      value: stats?.closingCents,
    },
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
              {fmt(item.value, { sign: item.sign ?? 'auto' })}
            </p>
          )}
          <p className={cn('mt-0.5 truncate text-[12px]', noData ? 'text-muted' : 'text-faint')}>
            {noData ? noDataYet : item.hint}
          </p>
        </div>
      ))}
    </Panel>
  );
}

function MonthlyComparison({ data, empty }: { data: Data | undefined; empty: Empty }) {
  const t = useMessages(cashFlowMessages).monthly;
  const page = useMessages(cashFlowMessages).page;
  const none = useMessages(common).noTransactions.title;
  const fmt = amount(data);
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
        {!data ? (
          <Skeleton className="h-[300px] w-full" />
        ) : (
          <>
            <div className={empty.noData ? 'opacity-40' : undefined}>
              <CapsuleBarChart
                layout="grouped"
                height={300}
                ariaLabel={t.chart}
                categories={data.months.map((m) => ({
                  key: m.month,
                  label: formatDate(`${m.month}-01`, 'LLL'),
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
                        {formatDate(`${m.month}-01`, 'LLLL yyyy')}
                        {m.projected && (
                          <span className="font-normal text-chart-1">{t.projectedSuffix}</span>
                        )}
                      </TooltipTitle>
                      <TooltipRow swatch="bg-chart-1" label={t.income} value={fmt(m.incomeCents)} />
                      <TooltipRow
                        swatch="bg-chart-2"
                        label={t.expenses}
                        value={fmt(m.expenseCents)}
                      />
                      <div className="mt-1.5 border-t border-line pt-1.5">
                        <TooltipRow
                          label={t.net}
                          value={fmt(m.netCents, { sign: 'always' })}
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

function BalanceProjection({ data, empty }: { data: Data | undefined; empty: Empty }) {
  const t = useMessages(cashFlowMessages).balance;
  const page = useMessages(cashFlowMessages).page;
  const projectedSuffix = useMessages(cashFlowMessages).monthly.projectedSuffix;
  const c = useMessages(common);
  const { noData } = empty;
  const fmt = amount(data);
  const threshold = data?.settings.lowBalanceThresholdCents ?? null;
  const missing = <span className="font-normal text-muted">{c.delta.noData}</span>;
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
        {!data ? (
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
                markers={noData ? [] : [{ date: data.today, label: t.today }]}
                threshold={
                  noData || threshold === null
                    ? undefined
                    : { value: threshold, label: t.buffer(fmt(threshold)) }
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
                        value={fmt(p.balanceCents)}
                        emphasis
                      />
                      {p.projected && p.lowCents !== undefined && (
                        <TooltipRow
                          label={t.range}
                          value={`${fmt(p.lowCents)} – ${fmt(p.highCents!)}`}
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
                missing
              ) : (
                <>
                  {fmt(data.stats.lowestCents)}{' '}
                  <span className="font-normal text-muted">
                    {t.on(formatDate(data.stats.lowestDate, 'd MMM'))}
                  </span>
                </>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted">{t.headroom}</dt>
            <dd
              className={cn(
                'tabular mt-0.5 text-[15px] font-medium',
                threshold !== null && data.stats.lowestCents < threshold
                  ? 'text-negative'
                  : 'text-positive',
              )}
            >
              {noData ? (
                missing
              ) : threshold === null ? (
                <span className="font-normal text-muted">{t.noBuffer}</span>
              ) : (
                fmt(data.stats.lowestCents - threshold)
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted">{t.change}</dt>
            <dd className="tabular mt-0.5 text-[15px] font-medium text-ink">
              {noData
                ? missing
                : fmt(data.stats.projectedCents - data.stats.closingCents, { sign: 'always' })}
            </dd>
          </div>
        </dl>
      )}
    </Panel>
  );
}

const COLLAPSED_ROWS = 10;

function UpcomingTable({ data }: { data: Data | undefined }) {
  const [expanded, setExpanded] = useState(false);
  const t = useMessages(cashFlowMessages).upcoming;
  const page = useMessages(cashFlowMessages).page;
  const fmt = amount(data);
  const rows = data ? (expanded ? data.upcoming : data.upcoming.slice(0, COLLAPSED_ROWS)) : [];
  const inflow =
    data?.upcoming.filter((u) => u.type === 'INCOME').reduce((s, u) => s + u.amountCents, 0) ?? 0;
  const outflow =
    data?.upcoming.filter((u) => u.type === 'EXPENSE').reduce((s, u) => s + u.amountCents, 0) ?? 0;
  const today = data ? new Date(`${data.today}T00:00:00`) : new Date();

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
                  <span className={cn('font-medium', inflow ? 'text-positive' : 'text-ink')}>
                    {fmt(inflow)}
                  </span>
                </span>
                <span className="text-muted">
                  {t.out} <span className="font-medium text-ink">{fmt(outflow)}</span>
                </span>
              </div>
            )
          }
        />
      </div>
      {!data ? (
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
                      {data.transactionCount === 0 ? page.noUpcoming : page.noneRecurring}
                    </td>
                  </tr>
                )}
                {rows.map((u) => (
                  <tr key={u.id} className="border-t border-line-soft hover:bg-hover/60">
                    <td className="tabular py-3 pr-3 pl-5 whitespace-nowrap text-ink-2 sm:pl-6">
                      {relativeDay(u.dueDate, today, 'EEE d MMM')}
                    </td>
                    <td className="w-full max-w-0 px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <TypeIcon type={u.type} size="sm" />
                        <div className="min-w-0 leading-tight">
                          <p className="truncate text-[14px] text-ink">{u.description}</p>
                          <p className="mt-1 truncate text-[12px] text-muted">{u.category}</p>
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
                      <Amount
                        cents={u.amountCents}
                        type={u.type === 'INCOME' ? 'income' : 'expense'}
                        currency={data.currency}
                        quietExpense
                      />
                    </td>
                    <td className="tabular hidden pr-5 pl-3 text-right text-muted sm:table-cell sm:pr-6">
                      {fmt(u.balanceAfterCents)}
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
