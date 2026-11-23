import { parseISO } from 'date-fns';
import { Bell, Menu as MenuIcon, Search } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAlerts } from '../api/finance';
import { Logo } from '../components/Logo';
import { IconButton } from '../components/ui/IconButton';
import { SearchField } from '../components/ui/Input';
import { Menu, MenuContent, MenuLabel, MenuTrigger } from '../components/ui/Menu';
import { useCurrentMembership } from '../features/auth/currentUser';
import { useDesktopNotifications } from '../features/notifications/desktop';
import { PeriodPicker } from '../features/dashboard/PeriodPicker';
import { useMessages } from '../i18n';
import { common } from '../i18n/common';
import { cn } from '../lib/cn';
import { money, relativeDay } from '../lib/format';
import type { NotificationPrefs } from '../stores/ui';

function GlobalSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const [value, setValue] = useState('');
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

  // Clear the query when leaving the transactions page (state adjusted during render, not in an effect).
  const [path, setPath] = useState(location.pathname);
  if (location.pathname !== path) {
    setPath(location.pathname);
    if (location.pathname !== '/transactions') setValue('');
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const q = value.trim();
    navigate(q ? `/transactions?q=${encodeURIComponent(q)}&range=all` : '/transactions');
  }

  return (
    <form role="search" onSubmit={submit} className="w-full max-w-[720px] min-w-0">
      <SearchField
        ref={inputRef}
        fieldSize="lg"
        value={value}
        onValueChange={setValue}
        placeholder={m.searchPlaceholder}
        aria-label={m.searchLabel}
        trailing={
          <kbd className="hidden h-6 min-w-6 items-center justify-center rounded-md border border-line-strong px-1.5 font-mono text-caption text-muted sm:flex">
            /
          </kbd>
        }
      />
    </form>
  );
}

const toneDot = { warning: 'bg-warning', negative: 'bg-negative' } as const;

interface Notice {
  /** Stable for one occurrence, so the desktop shows it once. */
  id: string;
  /** The Settings switch for this kind of alert. */
  pref: keyof NotificationPrefs;
  title: string;
  body: string;
  time: string;
  tone: keyof typeof toneDot;
  to: string;
}

/** The API's alerts, in words: a payment due soon, an overspent budget, a low balance ahead. */
function useNotices(): Notice[] {
  const { business } = useCurrentMembership();
  const { data } = useAlerts(business.id);
  const m = useMessages(common).topBar.alerts;
  if (!data) return [];
  const today = parseISO(data.today);
  const fmt = (cents: number) => money(cents, { decimals: 0, currency: business.currency });
  return data.alerts.map((alert): Notice => {
    switch (alert.kind) {
      case 'due-soon':
        return {
          id: `due-soon:${alert.description}:${alert.dueDate}`,
          pref: 'dueReminders',
          title: m.due(alert.description),
          body: m.dueBody(fmt(alert.amountCents)),
          time: relativeDay(alert.dueDate, today, 'EEE d MMM'),
          tone: 'warning',
          to: '/cash-flow#upcoming',
        };
      case 'over-budget':
        return {
          id: `over-budget:${alert.category}:${data.today.slice(0, 7)}`,
          pref: 'budgetAlerts',
          title: m.overBudget(alert.category),
          body: m.overBudgetBody(fmt(alert.spentCents), fmt(alert.limitCents)),
          time: m.thisMonth,
          tone: 'negative',
          to: '/budgets',
        };
      case 'low-balance':
        return {
          id: `low-balance:${alert.date}`,
          pref: 'lowBalance',
          title: m.lowBalance,
          body: m.lowBalanceBody(fmt(alert.balanceCents), fmt(alert.thresholdCents)),
          time: relativeDay(alert.date, today, 'd MMM'),
          tone: 'negative',
          to: '/cash-flow',
        };
    }
  });
}

function Notifications() {
  const navigate = useNavigate();
  const { business } = useCurrentMembership();
  const data = useNotices();
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
        <IconButton label={m.notifications} size="lg" bordered>
          <Bell strokeWidth={1.6} />
          {data.length > 0 && (
            <span className="absolute top-2.5 right-2.5 size-2 rounded-full border-2 border-raised bg-ink" />
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
 * search and notifications. On the dashboard it also
 * carries the date range the dashboard reports on.
 */
export function TopBar({ onOpenNavigation }: { onOpenNavigation: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const m = useMessages(common);
  return (
    <div className="flex h-[72px] items-center gap-3 sm:gap-4">
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
      <div className="hidden min-w-0 flex-1 sm:block">
        <GlobalSearch />
      </div>
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {location.pathname === '/' && <PeriodPicker />}
        <IconButton
          label={m.topBar.searchLabel}
          size="lg"
          bordered
          className="sm:hidden"
          onClick={() => navigate('/transactions')}
        >
          <Search />
        </IconButton>
        <Notifications />
      </div>
    </div>
  );
}
