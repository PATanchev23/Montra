import { format, parseISO } from 'date-fns';
import { Download, FileSpreadsheet, Printer, Receipt, TrendingUp } from 'lucide-react';
import { useState } from 'react';
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
import { formatDate, money, percent } from '../../lib/format';

const YEARS = [DEMO_TODAY.getFullYear(), DEMO_TODAY.getFullYear() - 1];

function exportProfitAndLoss(report: ReportData) {
  const header = ['Line', 'Type', ...report.quarters, 'Total'];
  const lines = report.rows.map((r) => [
    r.name,
    r.type,
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
    ['Net profit', '', ...net.map(centsToDecimal), centsToDecimal(report.summary.netCents)],
  ]);
}

function exportMonthly(report: ReportData) {
  downloadCsv(
    `techstore-monthly-cash-flow-${report.year}.csv`,
    ['Month', 'Income (EUR)', 'Expenses (EUR)', 'Net (EUR)', 'Projected'],
    report.monthlyNet.map((m) => [
      m.key,
      centsToDecimal(m.incomeCents),
      centsToDecimal(m.expenseCents),
      centsToDecimal(m.netCents),
      m.projected ? 'yes' : 'no',
    ]),
  );
}

async function exportYearTransactions(year: number) {
  const range = year === DEMO_TODAY.getFullYear() ? 'year' : 'all';
  const rows = (await exportTransactions({ range })).filter((t) => t.date.startsWith(String(year)));
  downloadCsv(
    `techstore-transactions-${year}.csv`,
    ['Date', 'Description', 'Counterparty', 'Type', 'Amount (EUR)'],
    rows.map((t) => [
      t.date,
      t.description,
      t.counterparty,
      t.type,
      centsToDecimal(t.type === 'income' ? t.amountCents : -t.amountCents),
    ]),
  );
}

export function ReportsPage() {
  const [year, setYear] = useState(YEARS[0]!);
  const { data, isPending, isError, isPlaceholderData, refetch } = useReport(year);

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Reports"
        title="Financial reports"
        description={
          data
            ? `${year} · ${data.asOf.startsWith(String(DEMO_TODAY.getFullYear())) ? `year to date, as of ${formatDate(data.asOf, 'd MMMM')}` : 'full year'}`
            : `${year}`
        }
        actions={
          <div className="no-print flex flex-wrap items-center gap-2">
            <Select
              label="Report year"
              value={String(year)}
              onChange={(v) => setYear(Number(v))}
              options={YEARS.map((y) => ({ value: String(y), label: String(y) }))}
              className="w-[96px]"
            />
            <Button onClick={() => window.print()}>
              <Printer />
              Print / PDF
            </Button>
            <Button
              variant="primary"
              disabled={!data}
              onClick={() => data && exportProfitAndLoss(data)}
            >
              <Download />
              Export P&L
            </Button>
          </div>
        }
      />

      {isError ? (
        <Panel>
          <ErrorState title="Could not build this report" onRetry={() => refetch()} />
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
          <Summary report={data} />
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <MonthlyRevenue report={data} />
            <Channels report={data} />
          </div>
          <ProfitAndLoss report={data} />
          <Exports report={data} />
        </div>
      )}
    </div>
  );
}

function Summary({ report }: { report: ReportData }) {
  const items = [
    {
      label: 'Revenue',
      value: money(report.summary.revenueCents, { decimals: 0 }),
      className: 'text-ink',
    },
    {
      label: 'Expenses',
      value: money(report.summary.expenseCents, { decimals: 0 }),
      className: 'text-ink',
    },
    {
      label: 'Net profit',
      value: money(report.summary.netCents, { decimals: 0, sign: 'always' }),
      className: report.summary.netCents < 0 ? 'text-negative' : 'text-positive',
    },
    {
      label: 'Net margin',
      value: percent(report.summary.margin, { decimals: 1 }),
      className: 'text-ink',
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

function MonthlyRevenue({ report }: { report: ReportData }) {
  const hasProjection = report.monthlyNet.some((m) => m.projected);
  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="monthly-revenue">
      <PanelHeader
        id="monthly-revenue"
        title="Monthly revenue"
        description={hasProjection ? 'Remaining months are projected' : 'Full year'}
        actions={
          hasProjection && (
            <Legend
              items={[
                { label: 'Actual', swatch: 'bg-chart-1' },
                { label: 'Projected', swatch: 'border-chart-1', dashed: true },
              ]}
            />
          )
        }
      />
      <div className="mt-6">
        <CapsuleBarChart
          height={260}
          maxBarWidth={44}
          ariaLabel={`Monthly revenue ${report.year}`}
          categories={report.monthlyNet.map((m) => ({
            key: m.key,
            label: m.label,
            projected: m.projected,
          }))}
          series={[
            {
              id: 'revenue',
              label: 'Revenue',
              tone: 'primary',
              values: report.monthlyNet.map((m) => m.incomeCents),
            },
          ]}
          renderTooltip={(i) => {
            const m = report.monthlyNet[i]!;
            return (
              <>
                <TooltipTitle>
                  {format(parseISO(`${m.key}-01`), 'MMMM yyyy')}
                  {m.projected && <span className="font-normal text-chart-1"> · projected</span>}
                </TooltipTitle>
                <TooltipRow
                  swatch="bg-chart-1"
                  label="Revenue"
                  value={money(m.incomeCents, { decimals: 0 })}
                  emphasis
                />
                <TooltipRow label="Expenses" value={money(m.expenseCents, { decimals: 0 })} />
                <TooltipRow
                  label="Net"
                  value={money(m.netCents, { decimals: 0, sign: 'always' })}
                />
              </>
            );
          }}
        />
      </div>
    </Panel>
  );
}

function Channels({ report }: { report: ReportData }) {
  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="channels">
      <PanelHeader
        id="channels"
        title="Revenue by channel"
        description={`${report.year} to date`}
      />
      <ul className="mt-6 space-y-5">
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
              <CapsuleProgress
                label={`${c.name} share of revenue`}
                value={c.share}
                max={1}
                tone="analytic"
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-6 border-t border-line pt-4 text-[12px] leading-relaxed text-muted">
        The online store remains the core channel; marketplace payouts settle weekly, B2B orders by
        bank transfer.
      </p>
    </Panel>
  );
}

function ProfitAndLoss({ report }: { report: ReportData }) {
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
          Total {label.toLowerCase()}
        </th>
        {[0, 1, 2, 3].map((q) => (
          <td key={q} className={cn(num, 'font-medium text-ink')}>
            {money(quarterSum(rows, q), { decimals: 0 })}
          </td>
        ))}
        <td className={cn(num, 'font-semibold text-ink')}>{money(total(rows), { decimals: 0 })}</td>
        <td className={cn(num, 'pr-5 text-muted sm:pr-6')}>
          {percent(revenue ? total(rows) / revenue : 0, { decimals: 1 })}
        </td>
      </tr>
    </tbody>
  );

  return (
    <Panel className="overflow-hidden" aria-labelledby="pnl">
      <div className="px-5 pt-5 pb-4 sm:px-6">
        <PanelHeader
          id="pnl"
          title="Profit & loss"
          description={
            currentQuarter >= 0 ? `By quarter · Q${currentQuarter + 1} to date` : 'By quarter'
          }
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-[13px]">
          <thead>
            <tr className="border-t border-line">
              <th scope="col" className={cn(head, 'pl-5 text-left sm:pl-6')}>
                Line
              </th>
              {report.quarters.map((q) => (
                <th key={q} scope="col" className={head}>
                  {q}
                </th>
              ))}
              <th scope="col" className={head}>
                Total
              </th>
              <th scope="col" className={cn(head, 'pr-5 sm:pr-6')}>
                % of revenue
              </th>
            </tr>
          </thead>
          {section('Revenue', income)}
          {section('Expenses', expenses)}
          <tbody>
            <tr className="border-t-2 border-line-strong">
              <th
                scope="row"
                className="py-3.5 pr-3 pl-5 text-left text-[14px] font-semibold text-ink sm:pl-6"
              >
                Net profit
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
                  report.summary.netCents < 0 ? 'text-negative' : 'text-positive',
                )}
              >
                {money(report.summary.netCents, { decimals: 0, sign: 'always' })}
              </td>
              <td className={cn(num, 'pr-5 font-medium text-ink sm:pr-6')}>
                {percent(report.summary.margin, { decimals: 1 })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Exports({ report }: { report: ReportData }) {
  const exports = [
    {
      icon: FileSpreadsheet,
      title: 'Profit & loss statement',
      body: 'Revenue and expenses by category and quarter',
      action: () => exportProfitAndLoss(report),
    },
    {
      icon: TrendingUp,
      title: 'Monthly cash flow',
      body: 'Income, expenses and net per month, projections flagged',
      action: () => exportMonthly(report),
    },
    {
      icon: Receipt,
      title: 'Transaction ledger',
      body: `Every transaction in ${report.year}, signed amounts`,
      action: () => exportYearTransactions(report.year),
    },
  ];
  return (
    <Panel className="no-print overflow-hidden" aria-labelledby="exports">
      <div className="px-5 pt-5 pb-4 sm:px-6">
        <PanelHeader
          id="exports"
          title="Exports"
          description="CSV files open in Excel, Numbers and Google Sheets"
        />
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
            <Button size="sm" onClick={action} aria-label={`Download ${title}`}>
              <Download />
              CSV
            </Button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
