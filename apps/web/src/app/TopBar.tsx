import { Bell, Menu as MenuIcon, Search } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { Logo } from '../components/Logo';
import { IconButton } from '../components/ui/IconButton';
import { SearchField } from '../components/ui/Input';
import { Menu, MenuContent, MenuLabel, MenuTrigger } from '../components/ui/Menu';
import { useCurrentMembership } from '../features/auth/currentUser';
import { useDesktopNotifications } from '../features/notifications/desktop';
import { useNotices } from '../features/notifications/notices';
import { PeriodPicker } from '../features/dashboard/PeriodPicker';
import { useMessages } from '../i18n';
import { common } from '../i18n/common';
import { cn } from '../lib/cn';

/**
 * The pages about the business's own money, where looking up a transaction,
 * supplier or category is a natural next step. Account and system pages
 * (Settings, Plans, System status, not found) leave the search out: it only
 * searches transactions, so there it would read as searching that page.
 */
const SEARCH_PAGES = ['/', '/transactions', '/budgets', '/cash-flow', '/simulations', '/reports'];

function hasSearch(pathname: string) {
  return SEARCH_PAGES.includes(pathname.replace(/(.)\/+$/, '$1'));
}

/** The query the transactions list is filtered by, or '' on any other page. */
function useUrlQuery() {
  const location = useLocation();
  const [params] = useSearchParams();
  return location.pathname.replace(/\/+$/, '') === '/transactions'
    ? (params.get('q')?.trim() ?? '')
    : '';
}

function GlobalSearch() {
  const navigate = useNavigate();
  const urlQuery = useUrlQuery();
  const [value, setValue] = useState(urlQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const m = useMessages(common).topBar;

  // "/" focuses search from anywhere, like most finance and dev tools.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.key === '/' &&
        !['INPUT', 'TEXTAREA'].includes(target.tagName) &&
        !target.isContentEditable
      ) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Follow the list's query: filled in from a /transactions?q= link, emptied by
  // the page's "Clear search" or by leaving it (state adjusted during render, not in an effect).
  const [shownQuery, setShownQuery] = useState(urlQuery);
  if (urlQuery !== shownQuery) {
    setShownQuery(urlQuery);
    setValue(urlQuery);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const q = value.trim();
    navigate(q ? `/transactions?q=${encodeURIComponent(q)}&range=all` : '/transactions');
  }

  return (
    <form role="search" onSubmit={submit} className="w-full max-w-[560px] min-w-0">
      <SearchField
        ref={inputRef}
        fieldSize="lg"
        value={value}
        onValueChange={setValue}
        placeholder={m.searchPlaceholder}
        aria-label={m.searchLabel}
        trailing={
          <kbd className="hidden h-6 min-w-6 items-center justify-center rounded-md bg-surface px-1.5 font-mono text-caption text-muted sm:flex">
            /
          </kbd>
        }
      />
    </form>
  );
}

const toneDot = { warning: 'bg-warning', negative: 'bg-negative' } as const;

function Notifications() {
  const navigate = useNavigate();
  const { business } = useCurrentMembership();
  const { notices: data } = useNotices();
  const m = useMessages(common).topBar;
  useDesktopNotifications(
    business.id,
    data.map((n) => ({
      key: n.id,
      pref: n.pref,
      title: n.title,
      body: `${n.body} · ${n.time}`,
      onClick: () => navigate(n.to),
    })),
  );

  return (
    <Menu>
      <MenuTrigger asChild>
        <IconButton label={m.notifications} size="md">
          <Bell strokeWidth={1.6} />
          {data.length > 0 && (
            <span className="absolute top-2 right-2 size-2 rounded-full border-2 border-canvas bg-ink" />
          )}
        </IconButton>
      </MenuTrigger>
      <MenuContent className="w-80">
        <MenuLabel>{m.notifications}</MenuLabel>
        {data.length === 0 && (
          <p className="px-2.5 pt-1 pb-3 text-body-sm text-muted">{m.noNotifications}</p>
        )}
        {data.map((n) => (
          <DropdownMenu.Item
            key={n.id}
            onSelect={() => navigate(n.to)}
            className="flex cursor-pointer gap-3 rounded-control px-2.5 py-2.5 outline-none data-[highlighted]:bg-hover"
          >
            <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', toneDot[n.tone])} />
            <span className="min-w-0 flex-1">
              <span className="block text-body-sm font-medium text-ink">{n.title}</span>
              <span className="block text-caption text-muted">{n.body}</span>
            </span>
            <span className="shrink-0 text-caption text-muted">{n.time}</span>
          </DropdownMenu.Item>
        ))}
      </MenuContent>
    </Menu>
  );
}

/**
 * One line above every page: navigation access where the sidebar is hidden,
 * search (on the money pages, see SEARCH_PAGES) and notifications. On the dashboard it also
 * carries the date range the dashboard reports on.
 */
export function TopBar({ onOpenNavigation }: { onOpenNavigation: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const m = useMessages(common);
  const search = hasSearch(location.pathname);
  return (
    <div className="flex h-16 items-center gap-3 sm:gap-4">
      <IconButton
        label={m.nav.openNavigation}
        className="hidden sm:inline-flex lg:hidden"
        onClick={onOpenNavigation}
      >
        <MenuIcon />
      </IconButton>
      <span className="sm:hidden">
        <Logo />
      </span>
      {search && (
        <div className="hidden min-w-0 flex-1 sm:block">
          <GlobalSearch />
        </div>
      )}
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {location.pathname === '/' && <PeriodPicker />}
        {search && (
          <IconButton
            label={m.topBar.searchLabel}
            size="md"
            className="sm:hidden"
            onClick={() => navigate('/transactions')}
          >
            <Search />
          </IconButton>
        )}
        <Notifications />
      </div>
    </div>
  );
}
