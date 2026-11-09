import {
  TRANSACTION_SORTS,
  transactionDateSchema,
  type TransactionSort,
  type TransactionType,
} from '@montra/shared';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfYear,
  format,
  startOfMonth,
  startOfYear,
} from 'date-fns';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { TransactionListParams } from '../../api/transactions';

export type SortKey = TransactionSort;
export type TypeFilter = 'all' | 'income' | 'expense';
export type DateRange = 'all' | '30d' | '90d' | 'month' | 'last-month' | 'year' | 'custom';

export const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'year', label: 'This year' },
  { value: 'custom', label: 'Custom range' },
];

export const PAGE_SIZE = 25;

const DEFAULT_SORT: SortKey = 'date_desc';
const iso = (date: Date) => format(date, 'yyyy-MM-dd');

/** The dates a preset covers, inclusive, counted from `today` on this device. */
export function presetBounds(
  range: Exclude<DateRange, 'custom'>,
  today: Date,
): { from?: string; to?: string } {
  switch (range) {
    case 'all':
      return {};
    case '30d':
      return { from: iso(addDays(today, -29)), to: iso(today) };
    case '90d':
      return { from: iso(addDays(today, -89)), to: iso(today) };
    case 'month':
      return { from: iso(startOfMonth(today)), to: iso(endOfMonth(today)) };
    case 'last-month': {
      const last = addMonths(today, -1);
      return { from: iso(startOfMonth(last)), to: iso(endOfMonth(last)) };
    }
    case 'year':
      return { from: iso(startOfYear(today)), to: iso(endOfYear(today)) };
  }
}

const validDate = (value: string | null) =>
  value && transactionDateSchema.safeParse(value).success ? value : '';

export interface TransactionFilters {
  type: TypeFilter;
  /** A category name; the API matches it ignoring case. Empty for all. */
  category: string;
  range: DateRange;
  /** Custom range bounds, yyyy-mm-dd; either may be empty. */
  from: string;
  to: string;
  sort: SortKey;
  page: number;
  /** A search from the top bar. The transactions API has no text search yet. */
  q: string;
}

export type FilterChanges = Partial<Omit<TransactionFilters, 'q'>> & { q?: string };

/** Reads filters from the URL, ignoring values the API would reject. */
export function filtersFromParams(params: URLSearchParams): TransactionFilters {
  const type = params.get('type');
  const sort = params.get('sort') as SortKey | null;
  const range = params.get('range') as DateRange | null;
  const from = validDate(params.get('from'));
  const to = validDate(params.get('to'));
  return {
    type: type === 'income' || type === 'expense' ? type : 'all',
    category: params.get('category')?.trim() ?? '',
    range:
      from || to || range === 'custom'
        ? 'custom'
        : range && DATE_RANGES.some((r) => r.value === range)
          ? range
          : 'all',
    from,
    to,
    sort: sort && TRANSACTION_SORTS.includes(sort) ? sort : DEFAULT_SORT,
    page: Math.max(1, Math.floor(Number(params.get('page'))) || 1),
    q: params.get('q')?.trim() ?? '',
  };
}

const apiType: Record<TypeFilter, TransactionType | undefined> = {
  all: undefined,
  income: 'INCOME',
  expense: 'EXPENSE',
};

/**
 * The API query for these filters, or an error when the custom range runs
 * backwards (the API would refuse it).
 */
export function listParamsFrom(
  filters: TransactionFilters,
  today: Date,
): { params: TransactionListParams; rangeError: string | null } {
  const bounds =
    filters.range === 'custom'
      ? { from: filters.from || undefined, to: filters.to || undefined }
      : presetBounds(filters.range, today);
  const rangeError =
    bounds.from && bounds.to && bounds.from > bounds.to
      ? 'The start date is after the end date.'
      : null;
  return {
    params: {
      page: filters.page,
      pageSize: PAGE_SIZE,
      sort: filters.sort,
      type: apiType[filters.type],
      category: filters.category || undefined,
      ...bounds,
    },
    rangeError,
  };
}

/**
 * Filters live in the URL so a filtered view can be bookmarked, shared and
 * reached from elsewhere (global search, insight links).
 */
export function useTransactionFilters() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(params), [params]);

  const update = useCallback(
    (changes: FilterChanges) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          const set = (key: string, value: string | undefined, fallback = '') => {
            if (!value || value === fallback) next.delete(key);
            else next.set(key, value);
          };
          if ('q' in changes) set('q', changes.q);
          if ('type' in changes) set('type', changes.type, 'all');
          if ('category' in changes) set('category', changes.category);
          if ('range' in changes) {
            set('range', changes.range, 'all');
            // A preset replaces a custom range; switching to custom starts it empty.
            next.delete('from');
            next.delete('to');
          }
          if ('from' in changes) set('from', changes.from);
          if ('to' in changes) set('to', changes.to);
          if (next.has('from') || next.has('to')) next.set('range', 'custom');
          if ('sort' in changes) set('sort', changes.sort, DEFAULT_SORT);
          // Any other change returns to the first page.
          set('page', 'page' in changes ? String(changes.page) : undefined, '1');
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const activeCount =
    (filters.type !== 'all' ? 1 : 0) +
    (filters.category ? 1 : 0) +
    (filters.range !== 'all' ? 1 : 0);

  const reset = useCallback(() => setParams({}, { replace: true }), [setParams]);

  return { filters, update, reset, activeCount };
}
