import type { CashFlowResponse } from '@montra/shared';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Equal,
  Landmark,
  Minus,
  Plus,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
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
import { formatDate, money, percent, relativeDay, type MoneyOptions } from '../../lib/format';
import { useOpenCount, useStayMounted } from '../../lib/presence';
import { useCurrentMembership } from '../auth/currentUser';
import { axisFormatter } from '../dashboard/axis';
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

/**
 * Cash flow: the detailed view the dashboard only summarises. A summary of
 * the figures behind the forecast, then the balance line in full width with
 * what it means for the next 90 days, then the last twelve months month by
 * month, then what is due in the next 30 days. Every section is a quiet
 * panel; nothing floats loose. Unlike the dashboard's Cash today panel, no
 * figure is set as a hero here: this page is for reading the detail.
 */
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
    <div className="flex flex-col gap-6">
      <PageHeader
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
          {data && <MismatchNote data={data} canEdit={canEdit} onEdit={() => setEditing(true)} />}
          {/* From 1280px the figures stand in a rail beside the two charts. */}
          <div className="grid gap-6 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <Overview data={data} empty={empty} onEdit={() => setEditing(true)} />
            <div className="flex min-w-0 flex-col gap-6">
              <BalanceProjection data={data} empty={empty} />
              <MonthlyComparison data={data} empty={empty} />
            </div>
          </div>
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

/** The entered bank balance is less than the history says should be there: say why, and how to fix it. */
function MismatchNote({
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
  if (balanceCents === null || balanceDate === null || start === null || start.cents >= 0) {
    return null;
  }
  return (
    <Panel
      role="note"
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-warning/30 bg-warning-soft/40 p-5 sm:px-6"
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

/**
 * Where the balances start, under the summary: from the owner's starting or
 * dated bank balance, or from zero until one is entered (an owner gets the way to enter
 * it). Nothing when the mismatch note above already explains the start.
 */
function StartNote({
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
  const start = data.ledgerStart;
  if (balanceCents !== null && balanceDate === null) {
    return (
      <p className="text-body-sm text-muted">
        {m.fromStart(money(balanceCents, { decimals: 2, currency: data.currency }))}
      </p>
    );
  }
  if (balanceCents !== null && balanceDate !== null) {
    if (start !== null && start.cents < 0) return null;
    return (
      <p className="text-body-sm text-muted">
        {m.from(
          money(balanceCents, { decimals: 2, currency: data.currency }),
          formatDate(balanceDate, 'd MMM yyyy'),
        )}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-body-sm text-muted">{canEdit ? m.unsetOwner : m.unsetViewer}</p>
      {canEdit && (
        <Button size="sm" variant="primary" onClick={onEdit}>
          {m.set}
        </Button>
      )}
    </div>
  );
}

const operatorIcons = { plus: Plus, minus: Minus, equals: Equal, then: ArrowRight } as const;
type Operator = keyof typeof operatorIcons;

/**
 * The sign before a figure of the statement. The projection's arrow sits in
 * a dashed ring, the way projected values are drawn on the charts.
 */
function OperatorMark({ kind }: { kind: Operator | undefined }) {
  if (!kind) return <span aria-hidden className="size-7 shrink-0" />;
  const Icon = operatorIcons[kind];
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-7 shrink-0 place-items-center rounded-full text-ink-2',
        kind === 'then' ? 'border border-dashed border-control' : 'bg-sunken',
      )}
    >
      <Icon className="size-3.5" strokeWidth={2.25} />
    </span>
  );
}

/** One line of the rail: a mark, its label with a quiet line beneath, and the figure at the right. */
function Line({
  mark,
  label,
  hint,
  children,
  className,
}: {
  mark: ReactNode;
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-4 py-5', className)}>
      {mark}
      <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4">
        <dt className="truncate text-body-sm text-muted">{label}</dt>
        <dd
          className={cn('col-start-2 row-start-1 text-right', hint !== undefined && 'row-span-2')}
        >
          {children}
        </dd>
        {hint !== undefined && <p className="truncate text-body-sm text-muted">{hint}</p>}
      </div>
    </div>
  );
}

/**
 * The rail beside the charts: the figures the forecast is built on, read as
 * a statement (where the twelve months opened, plus what came in, minus what
 * went out, is the balance today, which runs on to the projection), then
 * what the next 90 days hold. Under 1280px it sits above the charts, its two
 * halves side by side from 768px.
 */
function Overview({
  data,
  empty,
  onEdit,
}: {
  data: Data | undefined;
  empty: Empty;
  onEdit: () => void;
}) {
  const s = useMessages(cashFlowMessages).stats;
  const t = useMessages(cashFlowMessages).balance;
  const noDataYet = useMessages(common).delta.noData;
  const stats = data?.stats;
  const fmt = amount(data);
  const threshold = data?.settings.lowBalanceThresholdCents ?? null;
  const change = stats ? stats.projectedCents - stats.closingCents : 0;
  const Arrow = change < 0 ? ArrowDownRight : ArrowUpRight;
  const figure = 'tabular truncate text-figure-sm text-ink';
  const blank = <span aria-hidden className="size-7 shrink-0" />;
  /** A figure once it has loaded, the "no data yet" line for a business without transactions. */
  const show = (node: () => ReactNode) =>
    !stats ? (
      <Skeleton className="h-7 w-24" />
    ) : empty.noData ? (
      <span className="text-body-sm text-muted">{noDataYet}</span>
    ) : (
      node()
    );
  const items: {
    label: string;
    hint: string;
    value: number | undefined;
    operator?: Operator;
    tone?: string;
  }[] = [
    {
      label: s.opening,
      hint: stats ? formatDate(stats.openingDate, 'd MMM yyyy') : '',
      value: stats?.openingCents,
    },
    {
      label: s.moneyIn,
      hint: s.last12,
      value: stats?.incomeCents,
      operator: 'plus',
      tone: 'text-positive',
    },
    // The minus sign is the operator's: the figure itself is what went out.
    { label: s.moneyOut, hint: s.last12, value: stats?.expenseCents, operator: 'minus' },
    {
      label: s.today,
      hint: data ? formatDate(data.today, 'd MMM yyyy') : '',
      value: stats?.closingCents,
      operator: 'equals',
    },
    { label: s.projected, hint: s.in90, value: stats?.projectedCents, operator: 'then' },
  ];

  return (
    <Panel className="flex flex-col p-5 sm:p-6" aria-labelledby="cash-overview">
      <PanelHeader id="cash-overview" title={s.title} />
      <div className="mt-3 grid flex-1 gap-x-10 gap-y-4 md:grid-cols-2 xl:grid-cols-1 xl:content-between">
        <dl>
          {items.map((item, i) => (
            <Line
              key={item.label}
              mark={<OperatorMark kind={item.operator} />}
              label={item.label}
              hint={empty.noData ? noDataYet : item.hint}
              className={cn(
                i > 0 && 'border-t border-line-soft',
                // The total is ruled off, as on a statement; the projection follows it, dashed.
                item.operator === 'equals' && 'border-line-strong',
                item.operator === 'then' && 'border-dashed border-line-strong',
              )}
            >
              {item.value === undefined ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <p className={cn(figure, !empty.noData && item.tone)}>{fmt(item.value)}</p>
              )}
            </Line>
          ))}
        </dl>

        <section
          aria-labelledby="cash-ahead"
          className="flex flex-col border-t border-line pt-5 md:border-t-0 md:border-l md:pt-0 md:pl-10 xl:border-t xl:border-l-0 xl:pt-5 xl:pl-0"
        >
          <h3 id="cash-ahead" className="text-body font-medium text-ink">
            {s.ahead}
          </h3>
          <dl className="mt-1">
            <Line
              // The ring that marks this point on the balance line.
              mark={
                <span aria-hidden className="grid size-7 shrink-0 place-items-center">
                  <span className="size-2.5 rounded-full border-2 border-chart-1" />
                </span>
              }
              label={t.lowest}
              hint={
                stats && !empty.noData ? t.on(formatDate(stats.lowestDate, 'd MMM')) : undefined
              }
            >
              {show(() => (
                <p className={figure}>{fmt(stats!.lowestCents)}</p>
              ))}
            </Line>
            <Line mark={blank} label={t.headroom} className="border-t border-line-soft">
              {show(() =>
                threshold === null ? (
                  <span className="text-body-sm text-muted">{t.noBuffer}</span>
                ) : (
                  <p
                    className={cn(
                      figure,
                      stats!.lowestCents < threshold ? 'text-negative' : 'text-positive',
                    )}
                  >
                    {fmt(stats!.lowestCents - threshold)}
                  </p>
                ),
              )}
            </Line>
            <Line mark={blank} label={t.change} className="border-t border-line-soft">
              {show(() => (
                // The change carries an arrow and a sign as well as its colour.
                <p
                  className={cn(
                    figure,
                    'inline-flex items-center gap-0.5',
                    change < 0 ? 'text-negative' : change > 0 ? 'text-positive' : 'text-ink',
                  )}
                >
                  {change !== 0 && <Arrow aria-hidden className="size-4" strokeWidth={2} />}
                  {fmt(change, { sign: 'always' })}
                </p>
              ))}
            </Line>
          </dl>
          {data && (
            <div className="mt-auto border-t xl:mt-5 border-line pt-4 empty:hidden">
              <StartNote data={data} canEdit={empty.canEdit} onEdit={onEdit} />
            </div>
          )}
        </section>
      </div>
    </Panel>
  );
}

/**
 * The balance line across the panel's full width: daily history solid, the
 * projection dashed inside its likely range, today and the warning level
 * marked. Beneath it, what the line means: its lowest point ahead, the room
 * above the warning level, and the change over the next 90 days.
 */
function BalanceProjection({ data, empty }: { data: Data | undefined; empty: Empty }) {
  const t = useMessages(cashFlowMessages).balance;
  const page = useMessages(cashFlowMessages).page;
  const projectedSuffix = useMessages(cashFlowMessages).monthly.projectedSuffix;
  const c = useMessages(common);
  const { noData } = empty;
  const fmt = amount(data);
  const threshold = data?.settings.lowBalanceThresholdCents ?? null;
  const stats = data?.stats;

  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="balance-projection">
      <PanelHeader
        id="balance-projection"
        title={t.title}
        description={noData ? c.noTransactions.title : t.description}
      />
      <div className="relative mt-6">
        {!data ? (
          <Skeleton className="h-[260px] w-full" />
        ) : (
          <>
            <div className={noData ? 'opacity-40' : undefined}>
              <LineChart
                height={260}
                detailed
                ariaLabel={t.chart}
                formatTick={axisFormatter(
                  Math.max(0, ...data.balance.map((p) => p.highCents ?? p.balanceCents)),
                )}
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
                callouts={
                  noData || !stats
                    ? []
                    : [
                        { date: data.today, value: stats.closingCents, solid: true },
                        {
                          date: stats.lowestDate,
                          value: stats.lowestCents,
                          label: t.lowestAt(fmt(stats.lowestCents)),
                          below: true,
                        },
                        {
                          date: data.balance.at(-1)!.date,
                          value: stats.projectedCents,
                          label: fmt(stats.projectedCents),
                        },
                      ]
                }
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
      <div className="mt-5 border-t border-line pt-4">
        <Legend
          items={[
            { label: t.balance, swatch: 'bg-chart-1' },
            { label: t.projection, swatch: 'border-chart-1', dashed: true },
            { label: t.range, swatch: 'bg-chart-1/25' },
          ]}
        />
      </div>
    </Panel>
  );
}

/** The year's result as a sentence, with its amount set in the colour of what it means. */
function YearResult({ text, amount, tone }: { text: string; amount: string; tone: string }) {
  const at = text.indexOf(amount);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className={cn('font-semibold', tone)}>{amount}</span>
      {text.slice(at + amount.length)}
    </>
  );
}

/**
 * The last twelve months and the next three, one capsule a month: ink for
 * what was spent out of what came in, and on top of it a green cap for what
 * was kept or a red one for what was spent beyond it. Beneath, the year's
 * result in one plain line.
 */
function MonthlyComparison({ data, empty }: { data: Data | undefined; empty: Empty }) {
  const t = useMessages(cashFlowMessages).monthly;
  const page = useMessages(cashFlowMessages).page;
  const c = useMessages(common);
  const fmt = amount(data);
  const stats = data?.stats;
  const kept = stats ? stats.incomeCents - stats.expenseCents : 0;

  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="monthly-comparison">
      <PanelHeader
        id="monthly-comparison"
        title={t.title}
        description={empty.noData ? c.noTransactions.title : t.description}
      />
      <div className="relative mt-6">
        {!data ? (
          <Skeleton className="h-[230px] w-full" />
        ) : (
          <>
            <div className={empty.noData ? 'opacity-40' : undefined}>
              <CapsuleBarChart
                layout="kept"
                height={230}
                ariaLabel={t.chart}
                formatTick={axisFormatter(
                  Math.max(0, ...data.months.flatMap((m) => [m.incomeCents, m.expenseCents])),
                )}
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
                      <TooltipRow label={t.income} value={fmt(m.incomeCents)} />
                      <TooltipRow
                        swatch="bg-chart-1"
                        label={t.expenses}
                        value={fmt(m.expenseCents)}
                      />
                      <div className="mt-1.5 border-t border-line pt-1.5">
                        <TooltipRow
                          swatch={m.netCents >= 0 ? 'bg-chart-2' : 'bg-negative'}
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
      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-line pt-5">
        <p className="tabular text-body text-ink-2">
          {!stats || empty.noData ? (
            <span className="text-muted">{c.delta.noData}</span>
          ) : (
            <YearResult
              text={
                kept >= 0
                  ? t.keptYear(fmt(kept), percent(stats.incomeCents ? kept / stats.incomeCents : 0))
                  : t.overYear(fmt(-kept))
              }
              amount={fmt(Math.abs(kept))}
              tone={kept >= 0 ? 'text-ink' : 'text-negative'}
            />
          )}
        </p>
        <Legend
          items={[
            { label: t.spent, swatch: 'bg-chart-1' },
            { label: t.kept, swatch: 'bg-chart-2' },
            { label: t.overspent, swatch: 'bg-negative' },
            { label: t.projected, swatch: 'border-chart-1', dashed: true },
          ]}
        />
      </div>
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
      <div className="px-5 pt-5 pb-5 sm:px-6 sm:pt-6">
        <PanelHeader
          id="upcoming-heading"
          title={t.title}
          description={t.description}
          actions={
            data && (
              <div className="tabular flex gap-5 text-body-sm">
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
            <table className="w-full border-collapse text-body-sm">
              <thead>
                {/* Sentence-case labels, as everywhere else: no tracked capitals. */}
                <tr className="border-t border-line text-left text-caption whitespace-nowrap text-muted">
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
                      className="px-5 py-10 text-center text-body-sm text-muted sm:px-6"
                    >
                      {data.transactionCount === 0 ? page.noUpcoming : page.noneRecurring}
                    </td>
                  </tr>
                )}
                {rows.map((u) => (
                  <tr
                    key={u.id}
                    className="border-t border-line-soft transition-colors duration-150 hover:bg-hover/50"
                  >
                    <td className="tabular py-3 pr-3 pl-5 whitespace-nowrap text-ink-2 sm:pl-6">
                      {relativeDay(u.dueDate, today, 'EEE d MMM')}
                    </td>
                    <td className="w-full max-w-0 px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <TypeIcon type={u.type} size="sm" />
                        <div className="min-w-0 leading-tight">
                          <p className="truncate text-body text-ink">{u.description}</p>
                          <p className="mt-0.5 truncate text-caption text-muted">{u.category}</p>
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
                    <td className="px-3 text-right text-body">
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
