import {
  TRANSACTION_PAGE_SIZE_MAX,
  type ReportResponse,
  type Transaction,
  type TransactionType,
} from '@montra/shared';
import { Download, FileSpreadsheet, Printer, Receipt, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { useReport } from '../../api/finance';
import { fetchTransactions } from '../../api/transactions';
import { CapsuleBarChart } from '../../components/charts/CapsuleBarChart';
import { Legend, TooltipRow, TooltipTitle } from '../../components/charts/ChartTooltip';
import { CapsuleProgress } from '../../components/finance/CapsuleProgress';
import { EmptyChartNote } from '../../components/finance/EmptyChartNote';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel, PanelHeader } from '../../components/ui/Panel';
import { Select } from '../../components/ui/Select';
import { ErrorState, Skeleton } from '../../components/ui/States';
import { messagesFor, useMessages } from '../../i18n';
import { common } from '../../i18n/common';
import { cn } from '../../lib/cn';
import { centsToDecimal, downloadCsv } from '../../lib/csv';
import { formatDate, money, percent, type MoneyOptions } from '../../lib/format';
import { useCurrentMembership } from '../auth/currentUser';
import { reportMessages } from './messages';

type Report = ReportResponse;
type Row = Report['rows'][number];

const typeKey = (type: TransactionType) => (type === 'INCOME' ? 'income' : 'expense');
/** Spreadsheets run text starting with these as formulas; a leading quote keeps it text. */
const safeCell = (text: string) => (/^[=+\-@\t\r]/.test(text) ? `'${text}` : text);

/*
 * The report CSVs are read by people, so their headers follow the interface
 * language. Amounts keep a decimal point, which every spreadsheet imports.
 */
function exportProfitAndLoss(report: Report, slug: string) {
  const m = messagesFor(reportMessages).csv;
  const header = [m.line, m.type, 'Q1', 'Q2', 'Q3', 'Q4', m.total];
  const lines = report.rows.map((r) => [
    safeCell(r.category),
    m.types[typeKey(r.type)],
    ...r.quarters.map(centsToDecimal),
    centsToDecimal(r.totalCents),
  ]);
  const sum = (type: TransactionType, q: number) =>
    report.rows.filter((r) => r.type === type).reduce((s, r) => s + r.quarters[q]!, 0);
  const net = [0, 1, 2, 3].map((q) => sum('INCOME', q) - sum('EXPENSE', q));
  downloadCsv(`${slug}-profit-and-loss-${report.year}.csv`, header, [
    ...lines,
    [m.netProfit, '', ...net.map(centsToDecimal), centsToDecimal(report.summary.netCents)],
  ]);
}

function exportMonthly(report: Report, slug: string) {
  const m = messagesFor(reportMessages).csv;
  downloadCsv(
    `${slug}-monthly-cash-flow-${report.year}.csv`,
    [
      m.month,
      m.income(report.currency),
      m.expenses(report.currency),
      m.net(report.currency),
      m.projected,
    ],
    report.months.map((month) => [
      month.month,
      centsToDecimal(month.incomeCents),
      centsToDecimal(month.expenseCents),
      centsToDecimal(month.netCents),
      month.projected ? m.yes : m.no,
    ]),
  );
}

async function exportYearTransactions(businessId: string, report: Report, slug: string) {
  const rows: Transaction[] = [];
  for (let page = 1; ; page++) {
    const result = await fetchTransactions(businessId, {
      from: `${report.year}-01-01`,
      to: `${report.year}-12-31`,
      sort: 'date_asc',
      page,
      pageSize: TRANSACTION_PAGE_SIZE_MAX,
    });
    rows.push(...result.items);
    if (page >= result.pageCount) break;
  }
  const m = messagesFor(reportMessages).csv;
  downloadCsv(
    `${slug}-transactions-${report.year}.csv`,
    [m.date, m.description, m.category, m.type, m.amount(report.currency)],
    rows.map((t) => [
      t.date,
      safeCell(t.description),
      safeCell(t.category),
      m.types[typeKey(t.type)],
      centsToDecimal(t.type === 'INCOME' ? t.amountCents : -t.amountCents),
    ]),
  );
}

export function ReportsPage() {
  const { business, role } = useCurrentMembership();
  const [year, setYear] = useState<number | undefined>(undefined);
  const { data, isError, isPlaceholderData, refetch } = useReport(business.id, year);
  const noData = data !== undefined && data.rows.length === 0 && data.years.length <= 1;
  const empty = { noData, canEdit: role === 'OWNER' };
  const m = useMessages(reportMessages).page;
  const thisYear = data ? Number(data.today.slice(0, 4)) : undefined;

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow={m.eyebrow}
        title={m.title}
        description={
          data
            ? data.year === thisYear
              ? m.yearToDate(data.year, formatDate(data.asOf, 'd MMMM'))
              : m.fullYear(data.year)
            : ''
        }
        actions={
          <div className="no-print flex flex-wrap items-center gap-2">
            <Select
              label={m.year}
              value={String(data?.year ?? '')}
              onChange={(v) => setYear(Number(v))}
              options={(data?.years ?? []).map((y) => ({ value: String(y), label: String(y) }))}
              className="w-[96px]"
              disabled={!data}
            />
            <Button onClick={() => window.print()}>
              <Printer />
              {m.print}
            </Button>
            <Button
              variant="primary"
              disabled={!data || noData}
              onClick={() => data && exportProfitAndLoss(data, business.slug)}
            >
              <Download />
              {m.exportPnl}
            </Button>
          </div>
        }
      />

      {isError ? (
        <Panel>
          <ErrorState title={m.loadError} onRetry={() => refetch()} />
        </Panel>
      ) : !data ? (
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
            <Channels report={data} />
          </div>
          <ProfitAndLoss report={data} noData={noData} />
          <Exports report={data} noData={noData} businessId={business.id} slug={business.slug} />
        </div>
      )}
    </div>
  );
}

const formatter =
  (report: Report) =>
  (cents: number, options: MoneyOptions = {}) =>
    money(cents, { decimals: 0, ...options, currency: report.currency });

function Summary({ report, noData }: { report: Report; noData: boolean }) {
  const m = useMessages(reportMessages).summary;
  const noDataYet = useMessages(common).delta.noData;
  const fmt = formatter(report);
  const items = [
    { label: m.revenue, value: fmt(report.summary.revenueCents), className: 'text-ink' },
    { label: m.expenses, value: fmt(report.summary.expenseCents), className: 'text-ink' },
    {
      label: m.netProfit,
      value: fmt(report.summary.netCents, { sign: 'always' }),
      className: noData
        ? 'text-ink'
        : report.summary.netCents < 0
          ? 'text-negative'
          : 'text-positive',
    },
    {
      label: m.margin,
      // A margin of nothing is not 0%.
      value:
        report.summary.margin === null
          ? noDataYet
          : percent(report.summary.margin, { decimals: 1 }),
      className: report.summary.margin === null ? 'text-muted text-[16px] font-normal' : 'text-ink',
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
  report: Report;
  empty: { noData: boolean; canEdit: boolean };
}) {
  const hasProjection = report.months.some((m) => m.projected);
  const t = useMessages(reportMessages).monthly;
  const page = useMessages(reportMessages).page;
  const none = useMessages(common).noTransactions.title;
  const fmt = formatter(report);
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
            categories={report.months.map((m) => ({
              key: m.month,
              label: formatDate(`${m.month}-01`, 'LLL'),
              projected: m.projected,
            }))}
            series={[
              {
                id: 'revenue',
                label: t.revenue,
                tone: 'primary',
                values: report.months.map((m) => m.incomeCents),
              },
            ]}
            renderTooltip={(i) => {
              const m = report.months[i]!;
              return (
                <>
                  <TooltipTitle>
                    {formatDate(`${m.month}-01`, 'LLLL yyyy')}
                    {m.projected && (
                      <span className="font-normal text-chart-1">{t.projectedSuffix}</span>
                    )}
                  </TooltipTitle>
                  <TooltipRow
                    swatch="bg-chart-1"
                    label={t.revenue}
                    value={fmt(m.incomeCents)}
                    emphasis
                  />
                  <TooltipRow label={t.expenses} value={fmt(m.expenseCents)} />
                  <TooltipRow label={t.net} value={fmt(m.netCents, { sign: 'always' })} />
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

function Channels({ report }: { report: Report }) {
  const m = useMessages(reportMessages).channels;
  const page = useMessages(reportMessages).page;
  const fmt = formatter(report);
  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="channels">
      <PanelHeader id="channels" title={m.title} description={m.toDate(report.year)} />
      {report.channels.length === 0 && (
        <p className="mt-6 rounded-control bg-sunken px-4 py-6 text-center text-body-sm text-muted">
          {page.noRevenue}
        </p>
      )}
      <ul className="mt-6 space-y-5 empty:hidden">
        {report.channels.map((c) => {
          const share = c.shareBasisPoints / 10_000;
          return (
            <li key={c.category}>
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="truncate text-ink">{c.category}</span>
                <span className="tabular shrink-0 text-muted">
                  {fmt(c.cents)}{' '}
                  <span className="ml-1.5 font-medium text-ink">{percent(share)}</span>
                </span>
              </div>
              <div className="mt-2">
                <CapsuleProgress
                  label={m.share(c.category)}
                  value={share}
                  max={1}
                  tone="analytic"
                />
              </div>
            </li>
          );
        })}
      </ul>
      {report.channels.length > 0 && (
        <p className="mt-6 border-t border-line pt-4 text-[12px] leading-relaxed text-muted">
          {m.note}
        </p>
      )}
    </Panel>
  );
}

function ProfitAndLoss({ report, noData }: { report: Report; noData: boolean }) {
  const income = report.rows.filter((r) => r.type === 'INCOME');
  const expenses = report.rows.filter((r) => r.type === 'EXPENSE');
  const quarterSum = (rows: Row[], q: number) => rows.reduce((s, r) => s + r.quarters[q]!, 0);
  const total = (rows: Row[]) => rows.reduce((s, r) => s + r.totalCents, 0);
  const revenue = total(income);
  const thisYear = Number(report.today.slice(0, 4));
  const currentQuarter =
    report.year === thisYear ? Math.floor((Number(report.today.slice(5, 7)) - 1) / 3) : -1;
  const fmt = formatter(report);

  const head =
    'h-10 px-3 text-right text-[11px] font-medium tracking-[0.08em] text-muted uppercase';
  const num = 'tabular px-3 py-2.5 text-right whitespace-nowrap';
  const m = useMessages(reportMessages).pnl;

  const section = (label: string, rows: Row[]) => (
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
        <tr key={`${r.type}-${r.category}`} className="border-t border-line-soft">
          <th scope="row" className="py-2.5 pr-3 pl-5 text-left font-normal text-ink sm:pl-6">
            {r.category}
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
              {q ? fmt(q) : '—'}
            </td>
          ))}
          <td className={cn(num, 'font-medium text-ink')}>{fmt(r.totalCents)}</td>
          <td className={cn(num, 'pr-5 text-muted sm:pr-6')}>
            {revenue ? percent(r.totalCents / revenue, { decimals: 1 }) : '—'}
          </td>
        </tr>
      ))}
      <tr className="border-t border-line">
        <th scope="row" className="py-2.5 pr-3 pl-5 text-left font-medium text-ink sm:pl-6">
          {m.totalOf(label)}
        </th>
        {[0, 1, 2, 3].map((q) => (
          <td key={q} className={cn(num, 'font-medium text-ink')}>
            {fmt(quarterSum(rows, q))}
          </td>
        ))}
        <td className={cn(num, 'font-semibold text-ink')}>{fmt(total(rows))}</td>
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
              {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => (
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
                    {fmt(value, { sign: 'always' })}
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
                {fmt(report.summary.netCents, { sign: 'always' })}
              </td>
              <td className={cn(num, 'pr-5 font-medium text-ink sm:pr-6')}>
                {report.summary.margin === null
                  ? '—'
                  : percent(report.summary.margin, { decimals: 1 })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Exports({
  report,
  noData,
  businessId,
  slug,
}: {
  report: Report;
  noData: boolean;
  businessId: string;
  slug: string;
}) {
  const m = useMessages(reportMessages).exports;
  const exports = [
    {
      icon: FileSpreadsheet,
      title: m.pnl,
      body: m.pnlBody,
      action: () => exportProfitAndLoss(report, slug),
    },
    {
      icon: TrendingUp,
      title: m.monthly,
      body: m.monthlyBody,
      action: () => exportMonthly(report, slug),
    },
    {
      icon: Receipt,
      title: m.ledger,
      body: m.ledgerBody(report.year),
      action: () => void exportYearTransactions(businessId, report, slug),
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
