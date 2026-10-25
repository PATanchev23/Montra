import { ChevronLeft, ChevronRight, Download, Plus, SearchX } from 'lucide-react';
import { useState } from 'react';
import { accounts, categories, exportTransactions, useTransactions } from '../../api/finance';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel } from '../../components/ui/Panel';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States';
import { Tooltip } from '../../components/ui/Tooltip';
import type { Transaction } from '../../demo/types';
import { cn } from '../../lib/cn';
import { centsToDecimal, downloadCsv } from '../../lib/csv';
import { money } from '../../lib/format';
import { TransactionDetail } from './TransactionDetail';
import { TableSkeleton, TransactionsTable } from './TransactionsTable';
import { TransactionsToolbar } from './TransactionsToolbar';
import { useTransactionFilters } from './useTransactionFilters';

const PAGE_SIZE = 25;
const categoryName = Object.fromEntries(categories.map((c) => [c.id, c.name]));
const accountName = Object.fromEntries(accounts.map((a) => [a.id, a.name]));

export function TransactionsPage() {
  const filterState = useTransactionFilters();
  const { filters, update, reset } = filterState;
  const { data, isPending, isError, isPlaceholderData, refetch } = useTransactions({
    ...filters,
    pageSize: PAGE_SIZE,
  });
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const rows = await exportTransactions(filters);
      downloadCsv(
        `techstore-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          'Date',
          'Description',
          'Counterparty',
          'Category',
          'Account',
          'Type',
          'Amount (EUR)',
          'Status',
        ],
        rows.map((t) => [
          t.date,
          t.description,
          t.counterparty,
          categoryName[t.categoryId] ?? t.categoryId,
          accountName[t.accountId] ?? t.accountId,
          t.type,
          centsToDecimal(t.type === 'income' ? t.amountCents : -t.amountCents),
          t.status,
        ]),
      );
    } finally {
      setExporting(false);
    }
  }

  const first = data ? (data.page - 1) * PAGE_SIZE + 1 : 0;
  const last = data ? Math.min(data.total, data.page * PAGE_SIZE) : 0;

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Ledger"
        title="Transactions"
        description="Every payment in and out of TechStore, categorised and searchable."
        actions={
          <>
            <Button onClick={handleExport} disabled={!data?.total || exporting}>
              <Download />
              Export CSV
            </Button>
            <Tooltip content="Adding transactions arrives with the transactions API.">
              <span tabIndex={0} className="rounded-control">
                <Button variant="primary" disabled className="pointer-events-none">
                  <Plus />
                  New transaction
                </Button>
              </span>
            </Tooltip>
          </>
        }
      />

      <Panel className="grid grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {[
          {
            label: 'Money in',
            value: data?.totals.incomeCents,
            className: 'text-positive',
            sign: 'always' as const,
          },
          {
            label: 'Money out',
            value: data ? -data.totals.expenseCents : undefined,
            className: 'text-ink',
            sign: 'auto' as const,
          },
          {
            label: 'Net',
            value: data?.totals.netCents,
            className: 'text-ink',
            sign: 'always' as const,
          },
        ].map((stat) => (
          <div key={stat.label} className="px-5 py-4 sm:px-6">
            <p className="text-[13px] text-muted">{stat.label}</p>
            {stat.value === undefined ? (
              <Skeleton className="mt-2 h-7 w-32" />
            ) : (
              <p
                className={cn(
                  'tabular mt-1 text-[22px] font-semibold tracking-[-0.02em]',
                  stat.className,
                )}
              >
                {money(stat.value, { sign: stat.sign })}
              </p>
            )}
          </div>
        ))}
      </Panel>

      <Panel className="overflow-hidden">
        <div className="px-5 py-4 sm:px-6">
          <TransactionsToolbar {...filterState} />
        </div>

        {isError ? (
          <ErrorState onRetry={() => refetch()} className="border-t border-line" />
        ) : isPending ? (
          <TableSkeleton />
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No transactions match these filters"
            body="Try a wider date range or fewer filters."
            className="border-t border-line"
            action={<Button onClick={reset}>Clear filters</Button>}
          />
        ) : (
          <>
            <div
              className={cn(
                'overflow-x-auto transition-opacity duration-200',
                isPlaceholderData && 'opacity-60',
              )}
            >
              <TransactionsTable
                items={data.items}
                sort={filters.sort}
                onSort={(sort) => update({ sort })}
                onSelect={setSelected}
              />
            </div>
            <footer className="flex items-center justify-between gap-4 border-t border-line px-5 py-3 sm:px-6">
              <p className="tabular text-[13px] text-muted">
                Showing{' '}
                <span className="text-ink-2">
                  {first}–{last}
                </span>{' '}
                of <span className="text-ink-2">{data.total}</span>
              </p>
              <div className="flex items-center gap-1">
                <span className="tabular mr-2 text-[13px] text-muted">
                  Page {data.page} of {data.pageCount}
                </span>
                <IconButton
                  label="Previous page"
                  size="sm"
                  bordered
                  disabled={data.page <= 1}
                  onClick={() => update({ page: data.page - 1 })}
                >
                  <ChevronLeft />
                </IconButton>
                <IconButton
                  label="Next page"
                  size="sm"
                  bordered
                  disabled={data.page >= data.pageCount}
                  onClick={() => update({ page: data.page + 1 })}
                >
                  <ChevronRight />
                </IconButton>
              </div>
            </footer>
          </>
        )}
      </Panel>

      <TransactionDetail transaction={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
