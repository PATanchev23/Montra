import type { Transaction } from '@montra/shared';
import {
  BadgeEuro,
  Building2,
  CircleGauge,
  Plus,
  Search,
  Tag,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { useBudgets } from '../api/finance';
import { useTransactionCategories, useTransactionList } from '../api/transactions';
import { Amount } from '../components/finance/Amount';
import { SearchField } from '../components/ui/Input';
import { useBusinessAllowance, useCurrentMembership } from '../features/auth/currentUser';
import { TypeIcon } from '../features/transactions/TypeIcon';
import { useMessages } from '../i18n';
import { common } from '../i18n/common';
import { cn } from '../lib/cn';
import { formatDate, money } from '../lib/format';
import { primaryNav, secondaryNav } from './navigation';

/*
 * The top bar's search. As you type it finds, in this order: pages and the
 * owner's everyday actions, budgets, categories, and the business's own
 * transactions (asked of the API). Enter with nothing chosen lists every
 * matching transaction; the arrow keys choose a result, Enter opens it, and
 * Escape closes the list. A combobox over a listbox, as ARIA describes it.
 */

const PAGE_LIMIT = 5;
const CATEGORY_LIMIT = 3;
const TRANSACTION_LIMIT = 5;
/** Transactions are asked for once typing pauses, and from two characters. */
const DEBOUNCE_MS = 200;
const MIN_TRANSACTION_QUERY = 2;

type GroupKey = 'pages' | 'actions' | 'budgets' | 'categories' | 'transactions';

interface Result {
  id: string;
  group: GroupKey;
  title: string;
  meta?: string;
  icon: ReactNode;
  trailing?: ReactNode;
  /** Where the result leads, and any navigation state it carries. */
  to: string;
  state?: unknown;
}

const normalise = (text: string) => text.toLocaleLowerCase().normalize('NFKD');

function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

/** The query the transactions list is filtered by, or '' on any other page. */
function useUrlQuery() {
  const location = useLocation();
  const [params] = useSearchParams();
  return location.pathname.replace(/\/+$/, '') === '/transactions'
    ? (params.get('q')?.trim() ?? '')
    : '';
}

function IconTile({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-control bg-sunken text-ink-2">
      <Icon aria-hidden className="size-4" strokeWidth={1.75} />
    </span>
  );
}

/** The text with the first place it matches the query set in ink and semibold. */
function Highlight({ text, query }: { text: string; query: string }) {
  const at = query ? normalise(text).indexOf(normalise(query)) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="bg-transparent font-semibold text-ink">
        {text.slice(at, at + query.length)}
      </mark>
      {text.slice(at + query.length)}
    </>
  );
}

/** Everything the query finds, grouped, with whether transactions are still being asked for. */
function useResults(query: string, open: boolean) {
  const { business, role } = useCurrentMembership();
  const allowance = useBusinessAllowance();
  const s = useMessages(common).topBar.search;
  const nav = useMessages(common).nav;
  const q = query.trim();
  const needle = normalise(q);
  const debounced = useDebounced(q, DEBOUNCE_MS);
  const searching = open && q.length > 0;

  const budgets = useBudgets(business.id, undefined, { enabled: searching });
  const categories = useTransactionCategories(business.id, { enabled: searching });
  const transactionQuery = debounced.length >= MIN_TRANSACTION_QUERY ? debounced : '';
  const transactions = useTransactionList(
    business.id,
    { page: 1, pageSize: TRANSACTION_LIMIT, sort: 'date_desc', q: transactionQuery },
    { enabled: open && transactionQuery !== '' },
  );

  return useMemo(() => {
    // Names and other words in both languages: a page is found whichever one is typed.
    // A page is found by its name anywhere in it, in either language, or by
    // another word for it from the start of that word: "ad" finds "Add a
    // transaction", not Plans through "upgrade".
    const words = (label: string, key: keyof typeof s.keywords) => ({
      label: normalise(label),
      keywords: normalise(
        `${common.en.topBar.search.keywords[key]} ${common.bg.topBar.search.keywords[key]}`,
      ),
    });
    const matches = ({ label, keywords }: { label: string; keywords: string }) =>
      !needle || label.includes(needle) || ` ${keywords}`.includes(` ${needle}`);

    const pages: Result[] = [
      ...[...primaryNav, ...secondaryNav].map((item) => ({
        id: `page-${item.to}`,
        group: 'pages' as const,
        title: nav[item.label],
        icon: <IconTile icon={item.icon} />,
        to: item.to,
        words: words(
          `${common.en.nav[item.label]} ${common.bg.nav[item.label]}`,
          item.label as keyof typeof s.keywords,
        ),
      })),
      {
        id: 'page-/plans',
        group: 'pages' as const,
        title: s.plans,
        icon: <IconTile icon={BadgeEuro} />,
        to: '/plans',
        words: words(`${common.en.topBar.search.plans} ${common.bg.topBar.search.plans}`, 'plans'),
      },
    ]
      .filter((p) => matches(p.words))
      .slice(0, q ? PAGE_LIMIT : undefined);

    const actions: Result[] =
      role !== 'OWNER'
        ? []
        : (
            [
              ['addTransaction', Plus, '/transactions?new=1'],
              ['importTransactions', Upload, '/transactions?import=new'],
              ...(allowance.canAdd ? [['addBusiness', Building2, '/businesses/new'] as const] : []),
            ] as const
          )
            .filter(([key]) =>
              matches(
                words(`${common.en.topBar.search[key]} ${common.bg.topBar.search[key]}`, key),
              ),
            )
            .map(([key, icon, to]) => ({
              id: `action-${key}`,
              group: 'actions' as const,
              title: s[key],
              icon: <IconTile icon={icon} />,
              to,
            }));

    const budgetResults: Result[] = !q
      ? []
      : (budgets.data?.categories ?? [])
          .filter((b) => b.limitCents !== null && normalise(b.category).includes(needle))
          .map((b) => ({
            id: `budget-${b.category}`,
            group: 'budgets' as const,
            title: b.category,
            meta: s.perMonth(money(b.limitCents!, { decimals: 0, currency: business.currency })),
            icon: <IconTile icon={CircleGauge} />,
            to: '/budgets',
          }));

    const categoryResults: Result[] = !q
      ? []
      : (categories.data?.items ?? [])
          .filter((c) => normalise(c.name).includes(needle))
          .slice(0, CATEGORY_LIMIT)
          .map((c) => ({
            id: `category-${c.name}`,
            group: 'categories' as const,
            title: c.name,
            meta: s.inTransactions(c.incomeCount + c.expenseCount),
            icon: <IconTile icon={Tag} />,
            to: `/transactions?category=${encodeURIComponent(c.name)}&range=all`,
          }));

    const transactionResults: Result[] =
      !q || !transactionQuery || !transactions.data
        ? []
        : transactions.data.items.map((t: Transaction) => ({
            id: `transaction-${t.id}`,
            group: 'transactions' as const,
            title: t.description,
            meta: `${t.category} · ${formatDate(t.date, 'd MMM yyyy')}`,
            icon: <TypeIcon type={t.type} size="sm" />,
            trailing: (
              <Amount
                cents={t.amountCents}
                type={t.type === 'INCOME' ? 'income' : 'expense'}
                currency={business.currency}
                quietExpense
              />
            ),
            to: `/transactions?q=${encodeURIComponent(q)}&range=all`,
            state: { openTransaction: t },
          }));
    const total = transactions.data?.total ?? 0;
    if (transactionResults.length && total > transactionResults.length) {
      transactionResults.push({
        id: 'transactions-all',
        group: 'transactions',
        title: s.showAll(q),
        icon: <IconTile icon={Search} />,
        trailing: <span className="text-caption text-muted">{total}</span>,
        to: `/transactions?q=${encodeURIComponent(q)}&range=all`,
      });
    }

    return {
      groups: [
        ['pages', pages],
        ['actions', actions],
        ['budgets', budgetResults],
        ['categories', categoryResults],
        ['transactions', transactionResults],
      ] as [GroupKey, Result[]][],
      // Still typing, or the API not yet back for what was typed.
      loading:
        q.length >= MIN_TRANSACTION_QUERY &&
        (debounced !== q || (transactions.isFetching && !transactions.isError)),
    };
  }, [
    q,
    needle,
    debounced,
    transactionQuery,
    nav,
    s,
    role,
    allowance.canAdd,
    budgets.data,
    categories.data,
    transactions.data,
    transactions.isFetching,
    transactions.isError,
    business.currency,
  ]);
}

/**
 * The search field with its results. In the top bar (`bar`) the results
 * float under the field while it has focus; in the phone's search dialog
 * (`dialog`) they always show beneath it.
 */
export function GlobalSearch({
  variant = 'bar',
  onDone,
}: {
  variant?: 'bar' | 'dialog';
  /** Called once a result or search has been opened. */
  onDone?: () => void;
}) {
  const navigate = useNavigate();
  const urlQuery = useUrlQuery();
  const [value, setValue] = useState(urlQuery);
  const [focused, setFocused] = useState(variant === 'dialog');
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const m = useMessages(common).topBar;
  const s = m.search;
  const open = variant === 'dialog' || focused;
  const { groups, loading } = useResults(value, open);
  const flat = groups.flatMap(([, results]) => results);
  const q = value.trim();

  // "/" focuses search from anywhere, like most finance and dev tools.
  useEffect(() => {
    if (variant !== 'bar') return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.key === '/' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) &&
        !target.isContentEditable
      ) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [variant]);

  // Follow the list's query: filled in from a /transactions?q= link, emptied by
  // the page's "Clear search" or by leaving it (state adjusted during render, not in an effect).
  const [shownQuery, setShownQuery] = useState(urlQuery);
  if (urlQuery !== shownQuery) {
    setShownQuery(urlQuery);
    setValue(urlQuery);
  }

  function change(next: string) {
    setValue(next);
    setActive(-1);
  }

  function go(to: string, state?: unknown) {
    setFocused(false);
    setActive(-1);
    inputRef.current?.blur();
    navigate(to, state === undefined ? undefined : { state });
    onDone?.();
  }

  /** Enter with nothing chosen: every transaction that matches. */
  function searchAll() {
    if (!q) return;
    go(`/transactions?q=${encodeURIComponent(q)}&range=all`);
  }

  function handleKey(event: KeyboardEvent<HTMLInputElement>) {
    const count = flat.length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!count) return;
      event.preventDefault();
      setFocused(true);
      // Down from the field reaches the first result, and past the last one returns to the field.
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => {
        const next = i + step;
        if (next >= count) return -1;
        if (next < -1) return count - 1;
        return next;
      });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const chosen = active >= 0 ? flat[active] : undefined;
      if (chosen) go(chosen.to, chosen.state);
      else searchAll();
    } else if (event.key === 'Escape') {
      if (variant === 'bar' && (focused || value)) {
        event.preventDefault();
        if (active >= 0) setActive(-1);
        else {
          setFocused(false);
          inputRef.current?.blur();
        }
      }
    }
  }

  const activeId = active >= 0 && flat[active] ? `${listId}-${flat[active].id}` : undefined;
  const anything = flat.length > 0;
  const transactionCount = groups.find(([g]) => g === 'transactions')![1].length;

  const panel = (
    <div
      className={cn(
        variant === 'bar'
          ? 'absolute top-full right-0 left-0 z-30 mt-2 max-h-[min(30rem,70vh)] overflow-y-auto rounded-field border border-line bg-raised p-1.5 shadow-pop'
          : 'min-h-0 flex-1 overflow-y-auto px-1.5 pb-4',
      )}
    >
      <div id={listId} role="listbox" aria-label={m.searchLabel}>
        {groups.map(([group, results]) => {
          if (!results.length) return null;
          const headingId = `${listId}-${group}`;
          return (
            <div key={group} role="group" aria-labelledby={headingId} className="py-1">
              <p id={headingId} className="px-2.5 pt-1.5 pb-1 text-caption text-muted">
                {s[group]}
              </p>
              {results.map((result) => {
                const index = flat.indexOf(result);
                const isActive = index === active;
                return (
                  <div
                    key={result.id}
                    id={`${listId}-${result.id}`}
                    role="option"
                    aria-selected={isActive}
                    // Keep focus in the field, so the list stays open until the choice is made.
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseMove={() => !isActive && setActive(index)}
                    onClick={() => go(result.to, result.state)}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-control px-2.5 py-2 transition-colors duration-100',
                      isActive && 'bg-hover',
                    )}
                  >
                    {result.icon}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-sm text-ink-2">
                        <Highlight text={result.title} query={q} />
                      </span>
                      {result.meta && (
                        <span className="block truncate text-caption text-muted">
                          {result.meta}
                        </span>
                      )}
                    </span>
                    {result.trailing && (
                      <span className="tabular shrink-0 text-body-sm">{result.trailing}</span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {loading && transactionCount === 0 && (
        <p className="flex items-center gap-3 px-2.5 py-2 text-body-sm text-muted">
          <IconTile icon={Search} />
          {s.searching}
        </p>
      )}

      {q && !anything && !loading && (
        <p className="px-2.5 py-6 text-center text-body-sm text-muted">{s.nothing(q)}</p>
      )}

      {variant === 'bar' && anything && (
        <p className="mt-1 hidden items-center gap-1.5 border-t border-line-soft px-2.5 pt-2.5 pb-1 text-caption text-muted sm:flex">
          <kbd className="rounded-md bg-sunken px-1.5 font-sans">↑</kbd>
          <kbd className="rounded-md bg-sunken px-1.5 font-sans">↓</kbd>
          {s.hint}
        </p>
      )}
    </div>
  );

  return (
    <div
      className={cn(
        'relative min-w-0',
        variant === 'bar' ? 'w-full max-w-[560px]' : 'flex h-full flex-col',
      )}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setFocused(variant === 'dialog');
          setActive(-1);
        }
      }}
    >
      <div role="search" className={variant === 'dialog' ? 'p-4 pb-3' : undefined}>
        <SearchField
          ref={inputRef}
          fieldSize="lg"
          value={value}
          onValueChange={change}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKey}
          placeholder={m.searchPlaceholder}
          aria-label={m.searchLabel}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          autoFocus={variant === 'dialog'}
          autoComplete="off"
          trailing={
            variant === 'bar' && (
              <kbd className="hidden h-6 min-w-6 items-center justify-center rounded-md bg-surface px-1.5 font-mono text-caption text-muted sm:flex">
                /
              </kbd>
            )
          }
        />
      </div>
      {open && (variant === 'dialog' || anything || q) && panel}
      <p className="sr-only" aria-live="polite">
        {open && q && !loading ? (anything ? s.results(flat.length) : s.nothing(q)) : ''}
      </p>
    </div>
  );
}
