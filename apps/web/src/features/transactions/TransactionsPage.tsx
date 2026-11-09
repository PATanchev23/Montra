import {
  MONTRA_TEMPLATE_COLUMNS,
  TRANSACTION_PAGE_SIZE_MAX,
  type Transaction,
} from '@montra/shared';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Plus,
  ReceiptText,
  SearchX,
  Upload,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { errorMessage } from '../../api/client';
import {
  fetchTransactions,
  useTransactionCategories,
  useTransactionList,
  type TransactionListParams,
} from '../../api/transactions';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel } from '../../components/ui/Panel';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { Tooltip } from '../../components/ui/Tooltip';
import { cn } from '../../lib/cn';
import { centsToDecimal, downloadCsv } from '../../lib/csv';
import { showToast } from '../../stores/toasts';
import { FormNotice } from '../auth/AuthFields';
import { useCurrentMembership } from '../auth/currentUser';
import { ImportHistory } from '../imports/ImportHistory';
import { ImportSheet } from '../imports/ImportSheet';
import { typeLabel } from './display';
import { TransactionSheet, type SheetState } from './TransactionDetail';
import { TableSkeleton, TransactionsTable } from './TransactionsTable';
import { TransactionsToolbar } from './TransactionsToolbar';
import { listParamsFrom, useTransactionFilters } from './useTransactionFilters';

/** Spreadsheets run text starting with these as formulas; a leading quote keeps it text. */
const safeCell = (text: string) => (/^[=+\-@\t\r]/.test(text) ? `'${text}` : text);

/** Every transaction matching the filters, in the Montra template's columns, so it can be imported again. */
async function exportCsv(
  businessId: string,
  params: TransactionListParams,
  { currency, slug }: { currency: string; slug: string },
) {
  const rows: Transaction[] = [];
  for (let page = 1; ; page++) {
    const result = await fetchTransactions(businessId, {
      ...params,
      page,
      pageSize: TRANSACTION_PAGE_SIZE_MAX,
    });
    rows.push(...result.items);
    if (page >= result.pageCount) break;
  }
  downloadCsv(
    `${slug}-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
    MONTRA_TEMPLATE_COLUMNS.map((column) => column.header),
    rows.map((t) => [
      t.date,
      typeLabel(t.type),
      centsToDecimal(t.amountCents),
      safeCell(t.description),
      safeCell(t.category),
      currency,
      safeCell(t.externalId ?? ''),
    ]),
  );
  return rows.length;
}

type ImportSheetState = { importId: string | null } | null;

export function TransactionsPage() {
  const { business, role } = useCurrentMembership();
  const canEdit = role === 'OWNER';
  const { currency } = business;

  const filterState = useTransactionFilters();
  const { filters, update, reset, activeCount } = filterState;
  const today = new Date().toDateString();
  const { params, rangeError } = useMemo(
    () => listParamsFrom(filters, new Date(today)),
    [filters, today],
  );

  const list = useTransactionList(business.id, params, { enabled: !rangeError });
  const categories = useTransactionCategories(business.id);
  const categoryNames = useMemo(
    () => categories.data?.items.map((c) => c.name) ?? [],
    [categories.data],
  );

  const [sheet, setSheet] = useState<SheetState>(null);
  const [importSheet, setImportSheet] = useState<ImportSheetState>(null);
  const [exporting, setExporting] = useState(false);

  const { data, isPending, isError, isPlaceholderData, refetch, error } = list;

  // A page past the end (e.g. after deleting the last row on it): go to the last page.
  const pastEnd = data && data.items.length === 0 && data.total > 0 && data.page > data.pageCount;
  useEffect(() => {
    if (pastEnd) update({ page: data.pageCount });
  }, [pastEnd, data?.pageCount, update]);

  async function handleExport() {
    setExporting(true);
    try {
      const count = await exportCsv(business.id, params, { currency, slug: business.slug });
      showToast({ tone: 'positive', title: `Exported ${count} transactions` });
    } catch (err) {
      showToast({ tone: 'neutral', title: 'Export failed', body: errorMessage(err) });
    } finally {
      setExporting(false);
    }
  }

  const first = data ? (data.page - 1) * data.pageSize + 1 : 0;
  const last = data ? Math.min(data.total, data.page * data.pageSize) : 0;
  const filtered = activeCount > 0;

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Ledger"
        title="Transactions"
        description={`Every payment in and out of ${business.name}, in ${currency}.`}
        actions={
          <>
            <Button onClick={() => void handleExport()} disabled={!data?.total || exporting}>
              <Download />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
            {canEdit ? (
              <>
                <Button onClick={() => setImportSheet({ importId: null })}>
                  <Upload />
                  Import
                </Button>
                <Button variant="primary" onClick={() => setSheet({ mode: 'create' })}>
                  <Plus />
                  New transaction
                </Button>
              </>
            ) : (
              <Tooltip content="You can read transactions and imports. Only the business owner can add, change, delete or import them.">
                <span tabIndex={0} className="rounded-full">
                  <Badge tone="neutral">
                    <Eye className="size-3" strokeWidth={2} />
                    View only
                  </Badge>
                </span>
              </Tooltip>
            )}
          </>
        }
      />

      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-3 px-5 py-4 sm:px-6">
          <TransactionsToolbar
            {...filterState}
            categories={categories.data?.items ?? []}
            categoriesLoading={categories.isPending}
            rangeError={rangeError}
          />
          {filters.q && (
            <FormNotice tone="neutral">
              Searching by text isn’t available yet, so “{filters.q}” is not applied. Use the type,
              category and date filters instead.{' '}
              <button
                type="button"
                onClick={() => update({ q: '' })}
                className="cursor-pointer font-medium text-ink underline-offset-2 hover:underline"
              >
                Dismiss
              </button>
            </FormNotice>
          )}
        </div>

        {rangeError ? (
          <EmptyState
            icon={SearchX}
            title="Check the date range"
            body="The start date must be on or before the end date."
            className="border-t border-line"
          />
        ) : isError ? (
          <ErrorState
            title={errorMessage(error, 'Could not load transactions')}
            onRetry={() => refetch()}
            className="border-t border-line"
          />
        ) : isPending ? (
          <TableSkeleton />
        ) : data.total === 0 && !filtered ? (
          <EmptyState
            icon={ReceiptText}
            title="No transactions yet"
            body={
              canEdit
                ? 'Record your first payment, or import your history from a spreadsheet or bank statement.'
                : 'The business owner hasn’t recorded any transactions yet.'
            }
            className="border-t border-line"
            action={
              canEdit && (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => setImportSheet({ importId: null })}>
                    <Upload />
                    Import a file
                  </Button>
                  <Button variant="primary" onClick={() => setSheet({ mode: 'create' })}>
                    <Plus />
                    New transaction
                  </Button>
                </div>
              )
            }
          />
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
              aria-busy={isPlaceholderData}
              className={cn(
                'overflow-x-auto transition-opacity duration-200',
                isPlaceholderData && 'opacity-60',
              )}
            >
              <TransactionsTable
                items={data.items}
                currency={currency}
                sort={filters.sort}
                onSort={(sort) => update({ sort })}
                onSelect={(transaction) => setSheet({ mode: 'view', transaction })}
              />
            </div>
            <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line px-5 py-3 sm:px-6">
              <p className="tabular text-[13px] text-muted">
                Showing{' '}
                <span className="text-ink-2">
                  {first}–{last}
                </span>{' '}
                of <span className="text-ink-2">{data.total}</span>
              </p>
              <div className="flex items-center gap-1">
                <span className="tabular mr-2 text-[13px] text-muted">
                  Page {data.page} of {Math.max(1, data.pageCount)}
                </span>
                <IconButton
                  label="Previous page"
                  size="sm"
                  bordered
                  disabled={data.page <= 1 || isPlaceholderData}
                  onClick={() => update({ page: data.page - 1 })}
                >
                  <ChevronLeft />
                </IconButton>
                <IconButton
                  label="Next page"
                  size="sm"
                  bordered
                  disabled={data.page >= data.pageCount || isPlaceholderData}
                  onClick={() => update({ page: data.page + 1 })}
                >
                  <ChevronRight />
                </IconButton>
              </div>
            </footer>
          </>
        )}
      </Panel>

      <ImportHistory
        businessId={business.id}
        canEdit={canEdit}
        onOpen={(importId) => setImportSheet({ importId })}
      />

      <TransactionSheet
        state={sheet}
        onStateChange={setSheet}
        businessId={business.id}
        currency={currency}
        canEdit={canEdit}
        categories={categoryNames}
      />

      <ImportSheet
        open={importSheet !== null}
        importId={importSheet?.importId ?? null}
        onImportIdChange={(importId) => setImportSheet({ importId })}
        onClose={() => setImportSheet(null)}
        businessId={business.id}
        currency={currency}
        canEdit={canEdit}
      />
    </div>
  );
}
