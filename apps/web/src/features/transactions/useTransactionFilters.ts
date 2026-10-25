import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { DateRange, TransactionQuery } from '../../demo/api';
import type { AccountId, CategoryId, EntryType } from '../../demo/types';

export type SortKey = NonNullable<TransactionQuery['sort']>;

const RANGES: DateRange[] = ['30d', 'month', 'last-month', '90d', 'year', 'all'];
const SORTS: SortKey[] = ['date-desc', 'date-asc', 'amount-desc', 'amount-asc'];

/**
 * Filters live in the URL so a filtered view can be bookmarked, shared, and
 * reached from elsewhere (global search, insight links).
 */
export function useTransactionFilters() {
  const [params, setParams] = useSearchParams();

  const filters = useMemo(() => {
    const range = params.get('range') as DateRange | null;
    const sort = params.get('sort') as SortKey | null;
    const type = params.get('type');
    return {
      q: params.get('q') ?? '',
      type: (type === 'income' || type === 'expense' ? type : 'all') as EntryType | 'all',
      categories: (params.get('category')?.split(',').filter(Boolean) ?? []) as CategoryId[],
      account: (params.get('account') ?? 'all') as AccountId | 'all',
      range: range && RANGES.includes(range) ? range : '90d',
      sort: sort && SORTS.includes(sort) ? sort : 'date-desc',
      page: Math.max(1, Number(params.get('page')) || 1),
    } satisfies Required<Omit<TransactionQuery, 'pageSize'>>;
  }, [params]);

  const update = useCallback(
    (changes: Partial<typeof filters>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          const set = (key: string, value: string | undefined, fallback: string) => {
            if (!value || value === fallback) next.delete(key);
            else next.set(key, value);
          };
          if ('q' in changes) set('q', changes.q, '');
          if ('type' in changes) set('type', changes.type, 'all');
          if ('categories' in changes) set('category', changes.categories?.join(','), '');
          if ('account' in changes) set('account', changes.account, 'all');
          if ('range' in changes) set('range', changes.range, '90d');
          if ('sort' in changes) set('sort', changes.sort, 'date-desc');
          // Any filter change returns to the first page.
          set('page', 'page' in changes ? String(changes.page) : undefined, '1');
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const activeCount =
    (filters.q ? 1 : 0) +
    (filters.type !== 'all' ? 1 : 0) +
    (filters.categories.length ? 1 : 0) +
    (filters.account !== 'all' ? 1 : 0) +
    (filters.range !== '90d' ? 1 : 0);

  const reset = useCallback(() => setParams({}, { replace: true }), [setParams]);

  return { filters, update, reset, activeCount };
}
