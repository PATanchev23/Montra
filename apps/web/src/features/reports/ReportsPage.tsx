import { Download, FileSpreadsheet, Printer, Receipt, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DEMO_TODAY, exportTransactions, useReport } from '../../api/finance';
import { CapsuleBarChart } from '../../components/charts/CapsuleBarChart';
import { Legend, TooltipRow, TooltipTitle } from '../../components/charts/ChartTooltip';
import { CapsuleProgress } from '../../components/finance/CapsuleProgress';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel, PanelHeader } from '../../components/ui/Panel';
import { Select } from '../../components/ui/Select';
import { ErrorState, Skeleton } from '../../components/ui/States';
import type { ReportData } from '../../demo/api';
import { cn } from '../../lib/cn';
import { centsToDecimal, downloadCsv } from '../../lib/csv';
import { sampleDescription } from '../../demo/messages';
import { messagesFor, useMessages } from '../../i18n';
import { formatDate, money, percent } from '../../lib/format';
import { reportMessages } from './messages';
import { useHasTransactions } from '../../api/transactions';
import { EmptyChartNote } from '../../components/finance/EmptyChartNote';
import { common } from '../../i18n/common';
import { emptyReport } from '../noData';
import { useCurrentMembership } from '../auth/currentUser';

const YEARS = [DEMO_TODAY.getFullYear(), DEMO_TODAY.getFullYear() - 1];

/*
 * The report CSVs are read by people, so their headers follow the interface
 * language. Amounts keep a decimal point, which every spreadsheet imports.
 */
function exportProfitAndLoss(report: ReportData) {
  const m = messagesFor(reportMessages).csv;
  const header = [m.line, m.type, ...report.quarters, m.total];
  const lines = report.rows.map((r) => [
    r.name,
    m.types[r.type],
    ...r.quarters.map(centsToDecimal),
    centsToDecimal(r.total),
  ]);
  const sum = (type: 'income' | 'expense', q?: number) =>
    report.rows
      .filter((r) => r.type === type)
      .reduce((s, r) => s + (q === undefined ? r.total : r.quarters[q]!), 0);
  const net = [0, 1, 2, 3].map((q) => sum('income', q) - sum('expense', q));
  downloadCsv(`techstore-profit-and-loss-${report.year}.csv`, header, [
    ...lines,
    [m.netProfit, '', ...net.map(centsToDecimal), centsToDecimal(report.summary.netCents)],
  ]);
}

function exportMonthly(report: ReportData) {
  const m = messagesFor(reportMessages).csv;
  downloadCsv(
    `techstore-monthly-cash-flow-${report.year}.csv`,
    [m.month, m.income, m.expenses, m.net, m.projected],
    report.monthlyNet.map((month) => [
      month.key,
      centsToDecimal(month.incomeCents),
      centsToDecimal(month.expenseCents),
      centsToDecimal(month.netCents),
      month.projected ? m.yes : m.no,
    ]),
  );
}

async function exportYearTransactions(year: number) {
  const range = year === DEMO_TODAY.getFullYear() ? 'year' : 'all';
  const rows = (await exportTransactions({ range })).filter((t) => t.date.startsWith(String(year)));
  const m = messagesFor(reportMessages).csv;
  downloadCsv(
    `techstore-transactions-${year}.csv`,
    [m.date, m.description, m.counterparty, m.type, m.amount],
    rows.map((t) => [
      t.date,
      sampleDescription(t.description),
      t.counterparty,
      m.types[t.type],
      centsToDecimal(t.type === 'income' ? t.amountCents : -t.amountCents),
    ]),
  );
}

export function ReportsPage() {
  const [year, setYear] = useState(YEARS[0]!);
  // Reports come from the TechStore sample layer, which must not stand in for a
  // business that has recorded nothing: that business sees the same page, at zero,
  // with the exports off (there is nothing of its own to export).
  const { business, role } = useCurrentMembership();
  const gate = useHasTransactions(business.id);
  const noData = gate.hasTransactions === false;
  const sample = useReport(year, { enabled: gate.hasTransactions === true });
  const zero = useMemo(() => (noData ? emptyReport(year) : undefined), [noData, year]);
  const data = zero ?? sample.data;
  const isPending = !data;
  const { isError, isPlaceholderData, refetch } = sample;
  const empty = { noData, canEdit: role === 'OWNER' };
  const m = useMessages(reportMessages).page;

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow={m.eyebrow}
        title={m.title}
        description={
          data
            ? data.asOf.startsWith(String(DEMO_TODAY.getFullYear()))
              ? m.yearToDate(year, formatDate(data.asOf, 'd MMMM'))
              : m.fullYear(year)
            : `${year}`
        }
        actions={
          <div className="no-print flex flex-wrap items-center gap-2">
            <Select
              label={m.year}
              value={String(year)}
              onChange={(v) => setYear(Number(v))}
              options={YEARS.map((y) => ({ value: String(y), label: String(y) }))}
              className="w-[96px]"
            />
            <Button onClick={() => window.print()}>
              <Printer />
              {m.print}
            </Button>
            <Button
              variant="primary"
              disabled={!data || noData}
              onClick={() => data && exportProfitAndLoss(data)}
            >
              <Download />
              {m.exportPnl}
            </Button>
          </div>
        }
      />

      {!noData && (gate.isError || isError) ? (
        <Panel>
          <ErrorState
            title={m.loadError}
            onRetry={() => (gate.isError ? gate.refetch() : refetch())}
          />
        </Panel>
      ) : isPending ? (
        <div className="space-y-6">
          <Skeleton className="h-24 w-full rounded-panel" />
          <Skeleton className="h-80 w-full rounded-panel" />
        </div>
      ) : (
        <div
          className={cn(
            'flex flex-col gap-6 transition-opacity',
            isPlaceholderData && 'opacity-60',
          )}
        >
          <Summary report={data} noData={noData} />
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <MonthlyRevenue report={data} empty={empty} />
            <Channels report={data} noData={noData} />
          </div>
          <ProfitAndLoss report={data} noData={noData} />
          <Exports report={data} noData={noData} />
        </div>
      )}
    </div>
  );
}

function Summary({ report, noData }: { report: ReportData; noData: boolean }) {
  const m = useMessages(reportMessages).summary;
  const noDataYet = useMessages(common).delta.noData;
  const items = [
    {
      label: m.revenue,
      value: money(report.summary.revenueCents, { decimals: 0 }),
      className: 'text-ink',
    },
    {
      label: m.expenses,
      value: money(report.summary.expenseCents, { decimals: 0 }),
      className: 'text-ink',
    },
    {
      label: m.netProfit,
      value: money(report.summary.netCents, { decimals: 0, sign: 'always' }),
      className: noData
        ? 'text-ink'
        : report.summary.netCents < 0
          ? 'text-negative'
          : 'text-positive',
    },
    {
      label: m.margin,
      // A margin of nothing is not 0%.
      value: noData ? noDataYet : percent(report.summary.margin, { decimals: 1 }),
      className: noData ? 'text-muted text-[16px] font-normal' : 'text-ink',
    },
  ];
  return (
    <Panel className="grid grid-cols-2 gap-px overflow-hidden bg-line lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="bg-surface px-5 py-4 sm:px-6">
          <p className="text-[13px] text-muted">{item.label}</p>
          <p
            className={cn(
              'tabular mt-1 text-[24px] font-semibold tracking-[-0.02em]',
              item.className,
            )}
          >
            {item.value}
          </p>
        </div>
      ))}
    </Panel>
  );
}

function MonthlyRevenue({
  report,
  empty,
}: {
  report: ReportData;
  empty: { noData: boolean; canEdit: boolean };
}) {
  const hasProjection = report.monthlyNet.some((m) => m.projected);
  const t = useMessages(reportMessages).monthly;
  const page = useMessages(reportMessages).page;
  const none = useMessages(common).noTransactions.title;
  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="monthly-revenue">
      <PanelHeader
        id="monthly-revenue"
        title={t.title}
        description={empty.noData ? none : hasProjection ? t.projectedHint : t.fullYear}
        actions={
          hasProjection && (
            <Legend
              items={[
                { label: t.actual, swatch: 'bg-chart-1' },
                { label: t.projected, swatch: 'border-chart-1', dashed: true },
              ]}
            />
          )
        }
      />
      <div className="relative mt-6">
        <div className={empty.noData ? 'opacity-40' : undefined}>
          <CapsuleBarChart
            height={260}
            maxBarWidth={44}
            ariaLabel={t.chart(report.year)}
            categories={report.monthlyNet.map((m) => ({
              key: m.key,
              label: m.label,
              projected: m.projected,
            }))}
            series={[
              {
                id: 'revenue',
                label: t.revenue,
                tone: 'primary',
                values: report.monthlyNet.map((m) => m.incomeCents),
              },
            ]}
            renderTooltip={(i) => {
              const m = report.monthlyNet[i]!;
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
                    label={t.revenue}
                    value={money(m.incomeCents, { decimals: 0 })}
                    emphasis
                  />
                  <TooltipRow label={t.expenses} value={money(m.expenseCents, { decimals: 0 })} />
                  <TooltipRow
                    label={t.net}
                    value={money(m.netCents, { decimals: 0, sign: 'always' })}
                  />
                </>
              );
            }}
          />
        </div>
        {empty.noData && <EmptyChartNote canEdit={empty.canEdit} ownerText={page.chartOwner} />}
      </div>
    </Panel>
  );
}

function Channels({ report, noData }: { report: ReportData; noData: boolean }) {
  const m = useMessages(reportMessages).channels;
  const page = useMessages(reportMessages).page;
  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="channels">
      <PanelHeader id="channels" title={m.title} description={m.toDate(report.year)} />
      {noData && (
        <p className="mt-6 rounded-control bg-sunken px-4 py-6 text-center text-body-sm text-muted">
          {page.noRevenue}
        </p>
      )}
      <ul className="mt-6 space-y-5 empty:hidden">
        {report.channels.map((c) => (
          <li key={c.categoryId}>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="text-ink">{c.name}</span>
              <span className="tabular text-muted">
                {money(c.cents, { decimals: 0 })}{' '}
                <span className="ml-1.5 font-medium text-ink">{percent(c.share)}</span>
              </span>
            </div>
            <div className="mt-2">
              <CapsuleProgress label={m.share(c.name)} value={c.share} max={1} tone="analytic" />
            </div>
          </li>
        ))}
      </ul>
      {/* The note describes the sample store's channels. */}
      {!noData && (
        <p className="mt-6 border-t border-line pt-4 text-[12px] leading-relaxed text-muted">
          {m.note}
        </p>
      )}
    </Panel>
  );
}

function ProfitAndLoss({ report, noData }: { report: ReportData; noData: boolean }) {
  const income = report.rows.filter((r) => r.type === 'income');
  const expenses = report.rows
    .filter((r) => r.type === 'expense')
    .sort((a, b) => b.total - a.total);
  const quarterSum = (rows: typeof income, q: number) =>
    rows.reduce((s, r) => s + r.quarters[q]!, 0);
  const total = (rows: typeof income) => rows.reduce((s, r) => s + r.total, 0);
  const revenue = total(income);
  const currentQuarter =
    report.year === DEMO_TODAY.getFullYear() ? Math.floor(DEMO_TODAY.getMonth() / 3) : -1;

  const head =
    'h-10 px-3 text-right text-[11px] font-medium tracking-[0.08em] text-muted uppercase';
  const num = 'tabular px-3 py-2.5 text-right whitespace-nowrap';
  const m = useMessages(reportMessages).pnl;

  const section = (label: string, rows: typeof income) => (
    <tbody>
      <tr className="border-t border-line bg-sunken/70">
        <th
          scope="colgroup"
          colSpan={7}
          className="px-5 py-2 text-left text-[12px] font-medium text-ink-2 sm:px-6"
        >
          {label}
        </th>
      </tr>
      {rows.map((r) => (
        <tr key={r.categoryId} className="border-t border-line-soft">
          <th scope="row" className="py-2.5 pr-3 pl-5 text-left font-normal text-ink sm:pl-6">
            {r.name}
          </th>
          {r.quarters.map((q, i) => (
            <td
              key={i}
              className={cn(
                num,
                'text-ink-2',
                i > currentQuarter && currentQuarter >= 0 && 'text-faint',
              )}
            >
              {q ? money(q, { decimals: 0 }) : '—'}
            </td>
          ))}
          <td className={cn(num, 'font-medium text-ink')}>{money(r.total, { decimals: 0 })}</td>
          <td className={cn(num, 'pr-5 text-muted sm:pr-6')}>
            {percent(revenue ? r.total / revenue : 0, { decimals: 1 })}
          </td>
        </tr>
      ))}
      <tr className="border-t border-line">
        <th scope="row" className="py-2.5 pr-3 pl-5 text-left font-medium text-ink sm:pl-6">
          {m.totalOf(label)}
        </th>
        {[0, 1, 2, 3].map((q) => (
          <td key={q} className={cn(num, 'font-medium text-ink')}>
            {money(quarterSum(rows, q), { decimals: 0 })}
          </td>
        ))}
        <td className={cn(num, 'font-semibold text-ink')}>{money(total(rows), { decimals: 0 })}</td>
        <td className={cn(num, 'pr-5 text-muted sm:pr-6')}>
          {/* No revenue, no share of it. */}
          {revenue ? percent(total(rows) / revenue, { decimals: 1 }) : '—'}
        </td>
      </tr>
    </tbody>
  );

  return (
    <Panel className="overflow-hidden" aria-labelledby="pnl">
      <div className="px-5 pt-5 pb-4 sm:px-6">
        <PanelHeader
          id="pnl"
          title={m.title}
          description={currentQuarter >= 0 ? m.toDate(currentQuarter + 1) : m.byQuarter}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-[13px]">
          <thead>
            <tr className="border-t border-line">
              <th scope="col" className={cn(head, 'pl-5 text-left sm:pl-6')}>
                {m.line}
              </th>
              {report.quarters.map((q) => (
                <th key={q} scope="col" className={head}>
                  {q}
                </th>
              ))}
              <th scope="col" className={head}>
                {m.total}
              </th>
              <th scope="col" className={cn(head, 'pr-5 sm:pr-6')}>
                {m.ofRevenue}
              </th>
            </tr>
          </thead>
          {section(m.revenue, income)}
          {section(m.expenses, expenses)}
          <tbody>
            <tr className="border-t-2 border-line-strong">
              <th
                scope="row"
                className="py-3.5 pr-3 pl-5 text-left text-[14px] font-semibold text-ink sm:pl-6"
              >
                {m.netProfit}
              </th>
              {[0, 1, 2, 3].map((q) => {
                const value = quarterSum(income, q) - quarterSum(expenses, q);
                return (
                  <td
                    key={q}
                    className={cn(num, 'font-medium', value < 0 ? 'text-negative' : 'text-ink')}
                  >
                    {money(value, { decimals: 0, sign: 'always' })}
                  </td>
                );
              })}
              <td
                className={cn(
                  num,
                  'text-[14px] font-semibold',
                  noData
                    ? 'text-ink'
                    : report.summary.netCents < 0
                      ? 'text-negative'
                      : 'text-positive',
                )}
              >
                {money(report.summary.netCents, { decimals: 0, sign: 'always' })}
              </td>
              <td className={cn(num, 'pr-5 font-medium text-ink sm:pr-6')}>
                {noData ? '—' : percent(report.summary.margin, { decimals: 1 })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Exports({ report, noData }: { report: ReportData; noData: boolean }) {
  const m = useMessages(reportMessages).exports;
  const exports = [
    {
      icon: FileSpreadsheet,
      title: m.pnl,
      body: m.pnlBody,
      action: () => exportProfitAndLoss(report),
    },
    {
      icon: TrendingUp,
      title: m.monthly,
      body: m.monthlyBody,
      action: () => exportMonthly(report),
    },
    {
      icon: Receipt,
      title: m.ledger,
      body: m.ledgerBody(report.year),
      action: () => exportYearTransactions(report.year),
    },
  ];
  return (
    <Panel className="no-print overflow-hidden" aria-labelledby="exports">
      <div className="px-5 pt-5 pb-4 sm:px-6">
        <PanelHeader id="exports" title={m.title} description={m.description} />
      </div>
      <ul className="grid border-t border-line md:grid-cols-3 md:divide-x md:divide-line">
        {exports.map(({ icon: Icon, title, body, action }) => (
          <li
            key={title}
            className="flex items-start gap-3.5 border-b border-line px-5 py-4 last:border-b-0 sm:px-6 md:border-b-0"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-hover text-ink-2">
              <Icon className="size-[18px]" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-ink">{title}</p>
              <p className="mt-0.5 text-[12px] text-muted">{body}</p>
            </div>
            <Button size="sm" onClick={action} disabled={noData} aria-label={m.download(title)}>
              <Download />
              CSV
            </Button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
