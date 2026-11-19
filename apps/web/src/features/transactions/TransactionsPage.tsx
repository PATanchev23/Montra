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
import { useSearchParams } from 'react-router';
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
import { useMessages } from '../../i18n';
import { count } from '../../lib/format';
import { templateTypeLabel } from './display';
import { transactionMessages } from './messages';
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
      templateTypeLabel(t.type),
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
  const t = useMessages(transactionMessages);
  const m = t.page;

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

  // Links from elsewhere (the empty dashboard) open a sheet: ?import=new or ?new=1.
  // Read once on arrival; the parameter is then dropped from the address, so going
  // back or reloading does not reopen it.
  const [searchParams, setSearchParams] = useSearchParams();
  const openImport = searchParams.get('import') === 'new';
  const openNew = searchParams.get('new') === '1';
  const [sheet, setSheet] = useState<SheetState>(() =>
    canEdit && openNew && !openImport ? { mode: 'create' } : null,
  );
  const [importSheet, setImportSheet] = useState<ImportSheetState>(() =>
    canEdit && openImport ? { importId: null } : null,
  );
  const [exporting, setExporting] = useState(false);
  useEffect(() => {
    if (!openImport && !openNew) return;
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('import');
        next.delete('new');
        return next;
      },
      { replace: true },
    );
  }, [openImport, openNew, setSearchParams]);

  const { data, isPending, isError, isPlaceholderData, refetch, error } = list;

  // A page past the end (e.g. after deleting the last row on it): go to the last page.
  const pastEnd = data && data.items.length === 0 && data.total > 0 && data.page > data.pageCount;
  useEffect(() => {
    if (pastEnd) update({ page: data.pageCount });
  }, [pastEnd, data?.pageCount, update]);

  async function handleExport() {
    setExporting(true);
    try {
      const exported = await exportCsv(business.id, params, { currency, slug: business.slug });
      showToast({ tone: 'positive', title: m.exported(exported) });
    } catch (err) {
      showToast({ tone: 'neutral', title: m.exportFailed, body: errorMessage(err) });
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
        eyebrow={m.eyebrow}
        title={m.title}
        description={m.description(business.name, currency)}
        actions={
          <>
            <Button onClick={() => void handleExport()} disabled={!data?.total || exporting}>
              <Download />
              {exporting ? m.exporting : m.export}
            </Button>
            {canEdit ? (
              <>
                <Button onClick={() => setImportSheet({ importId: null })}>
                  <Upload />
                  {m.import}
                </Button>
                <Button variant="primary" onClick={() => setSheet({ mode: 'create' })}>
                  <Plus />
                  {m.newTransaction}
                </Button>
              </>
            ) : (
              <Tooltip content={m.viewOnlyHint}>
                <span tabIndex={0} className="rounded-full">
                  <Badge tone="neutral">
                    <Eye className="size-3" strokeWidth={2} />
                    {m.viewOnly}
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
              {m.searchUnavailable(filters.q)}{' '}
              <button
                type="button"
                onClick={() => update({ q: '' })}
                className="cursor-pointer font-medium text-ink underline-offset-2 hover:underline"
              >
                {m.dismiss}
              </button>
            </FormNotice>
          )}
        </div>

        {rangeError ? (
          <EmptyState
            icon={SearchX}
            title={m.checkRange}
            body={m.checkRangeBody}
            className="border-t border-line"
          />
        ) : isError ? (
          <ErrorState
            title={errorMessage(error, m.loadError)}
            onRetry={() => refetch()}
            className="border-t border-line"
          />
        ) : isPending ? (
          <TableSkeleton />
        ) : data.total === 0 && !filtered ? (
          <EmptyState
            icon={ReceiptText}
            title={m.empty}
            body={canEdit ? m.emptyOwner : m.emptyViewer}
            className="border-t border-line"
            action={
              canEdit && (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => setImportSheet({ importId: null })}>
                    <Upload />
                    {m.importFile}
                  </Button>
                  <Button variant="primary" onClick={() => setSheet({ mode: 'create' })}>
                    <Plus />
                    {m.newTransaction}
                  </Button>
                </div>
              )
            }
          />
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={m.noMatch}
            body={m.noMatchBody}
            className="border-t border-line"
            action={<Button onClick={reset}>{m.clearFilters}</Button>}
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
                {m.showing.before && <>{m.showing.before} </>}
                <span className="text-ink-2">
                  {count(first)}–{count(last)}
                </span>{' '}
                {m.showing.of} <span className="text-ink-2">{count(data.total)}</span>
              </p>
              <div className="flex items-center gap-1">
                <span className="tabular mr-2 text-[13px] text-muted">
                  {m.pageOf(count(data.page), count(Math.max(1, data.pageCount)))}
                </span>
                <IconButton
                  label={m.previous}
                  size="sm"
                  bordered
                  disabled={data.page <= 1 || isPlaceholderData}
                  onClick={() => update({ page: data.page - 1 })}
                >
                  <ChevronLeft />
                </IconButton>
                <IconButton
                  label={m.next}
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
