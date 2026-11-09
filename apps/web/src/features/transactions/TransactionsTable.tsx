import type { Transaction } from '@montra/shared';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Amount } from '../../components/finance/Amount';
import { cn } from '../../lib/cn';
import { formatDate, money, relativeDay } from '../../lib/format';
import { entryType, sourceLabels, typeLabel } from './display';
import { TypeIcon } from './TypeIcon';
import type { SortKey } from './useTransactionFilters';

function SortButton({
  column,
  sort,
  onSort,
  children,
  align = 'left',
}: {
  column: 'date' | 'amount';
  sort: SortKey;
  onSort: (sort: SortKey) => void;
  children: string;
  align?: 'left' | 'right';
}) {
  const active = sort.startsWith(column);
  const descending = sort.endsWith('desc');
  const Icon = !active ? ArrowUpDown : descending ? ArrowDown : ArrowUp;
  return (
    <button
      type="button"
      onClick={() => onSort(`${column}_${active && descending ? 'asc' : 'desc'}`)}
      className={cn(
        'inline-flex cursor-pointer items-center gap-1 rounded-md uppercase hover:text-ink',
        active && 'text-ink-2',
        align === 'right' && 'flex-row-reverse',
      )}
    >
      {children}
      <Icon className={cn('size-3', !active && 'opacity-50')} strokeWidth={2} />
    </button>
  );
}

const ariaSort = (sort: SortKey, column: 'date' | 'amount') =>
  sort.startsWith(column) ? (sort.endsWith('desc') ? 'descending' : 'ascending') : 'none';

const signed = (t: Transaction) => (t.type === 'INCOME' ? t.amountCents : -t.amountCents);

const headerCell =
  'h-10 px-3 text-left text-[11px] font-medium tracking-[0.08em] text-muted uppercase first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6';
const cell = 'px-3 py-3 first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6';

/**
 * One page of history. Sorted by date, rows are grouped by day with each
 * day's net; sorted by amount, each row carries its own date instead.
 */
export function TransactionsTable({
  items,
  currency,
  sort,
  onSort,
  onSelect,
  today = new Date(),
}: {
  items: Transaction[];
  currency: string;
  sort: SortKey;
  onSort: (sort: SortKey) => void;
  onSelect: (transaction: Transaction) => void;
  today?: Date;
}) {
  const grouped = sort.startsWith('date');
  const groups: { date: string; items: Transaction[] }[] = [];
  if (grouped) {
    for (const t of items) {
      const last = groups.at(-1);
      if (last?.date === t.date) last.items.push(t);
      else groups.push({ date: t.date, items: [t] });
    }
  }

  const row = (t: Transaction) => (
    <tr
      key={t.id}
      tabIndex={0}
      onClick={() => onSelect(t)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(t))}
      className="group cursor-pointer border-t border-line-soft transition-colors hover:bg-hover/60 focus-visible:bg-hover focus-visible:outline-none"
      aria-label={`${t.description}, ${typeLabel(t.type)}, ${t.category}, ${formatDate(t.date, 'd MMMM yyyy')}, ${money(signed(t), { currency })}`}
    >
      {!grouped && (
        <td className={cn(cell, 'tabular text-[13px] whitespace-nowrap text-ink-2')}>
          {formatDate(t.date, 'd MMM yyyy')}
        </td>
      )}
      <td className={cn(cell, 'w-full max-w-0')}>
        <div className="flex items-center gap-3">
          <TypeIcon type={t.type} size="sm" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[14px] text-ink">{t.description}</p>
            <p className="mt-1 truncate text-[12px] text-muted">
              <span className="md:hidden">{t.category} · </span>
              {typeLabel(t.type)}
            </p>
          </div>
        </div>
      </td>
      <td className={cn(cell, 'hidden text-[13px] whitespace-nowrap text-ink-2 md:table-cell')}>
        {t.category}
      </td>
      <td className={cn(cell, 'hidden text-[12px] whitespace-nowrap text-muted lg:table-cell')}>
        {t.importSource ? sourceLabels[t.importSource] : 'Manual'}
      </td>
      <td className={cn(cell, 'text-right text-[14px]')}>
        <Amount cents={t.amountCents} type={entryType(t.type)} currency={currency} />
      </td>
    </tr>
  );

  return (
    <table className="w-full table-auto border-collapse">
      <thead>
        <tr className="border-t border-line">
          {!grouped && (
            <th scope="col" className={headerCell} aria-sort={ariaSort(sort, 'date')}>
              <SortButton column="date" sort={sort} onSort={onSort}>
                Date
              </SortButton>
            </th>
          )}
          <th
            scope="col"
            className={headerCell}
            aria-sort={grouped ? ariaSort(sort, 'date') : undefined}
          >
            {grouped ? (
              <SortButton column="date" sort={sort} onSort={onSort}>
                Transaction
              </SortButton>
            ) : (
              'Transaction'
            )}
          </th>
          <th scope="col" className={cn(headerCell, 'hidden md:table-cell')}>
            Category
          </th>
          <th scope="col" className={cn(headerCell, 'hidden lg:table-cell')}>
            Source
          </th>
          <th
            scope="col"
            className={cn(headerCell, 'text-right')}
            aria-sort={ariaSort(sort, 'amount')}
          >
            <SortButton column="amount" sort={sort} onSort={onSort} align="right">
              Amount
            </SortButton>
          </th>
        </tr>
      </thead>
      {grouped ? (
        groups.map((group) => {
          const net = group.items.reduce((sum, t) => sum + signed(t), 0);
          return (
            <tbody key={group.date}>
              <tr className="border-t border-line bg-sunken/70">
                <th
                  scope="colgroup"
                  colSpan={3}
                  className="px-5 py-2 text-left text-[12px] font-medium text-ink-2 sm:px-6"
                >
                  {relativeDay(group.date, today, 'EEEE')}
                  <span className="font-normal text-muted">
                    {' '}
                    · {formatDate(group.date, 'd MMMM yyyy')}
                  </span>
                </th>
                <td className="tabular px-5 py-2 text-right text-[12px] whitespace-nowrap text-muted sm:px-6">
                  <span className="sr-only">Net for the day on this page: </span>
                  {money(net, { sign: 'always', currency })}
                </td>
              </tr>
              {group.items.map(row)}
            </tbody>
          );
        })
      ) : (
        <tbody>{items.map(row)}</tbody>
      )}
    </table>
  );
}

export function TableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div aria-hidden className="border-t border-line">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-line-soft px-6 py-3.5">
          <span className="size-8 animate-pulse rounded-[10px] bg-hover" />
          <span className="flex-1 space-y-2">
            <span className="block h-3.5 w-48 animate-pulse rounded bg-hover" />
            <span className="block h-3 w-28 animate-pulse rounded bg-hover" />
          </span>
          <span className="hidden h-3.5 w-24 animate-pulse rounded bg-hover md:block" />
          <span className="h-3.5 w-20 animate-pulse rounded bg-hover" />
        </div>
      ))}
    </div>
  );
}
