import { Bell, Menu as MenuIcon, Search, X } from 'lucide-react';
import { Dialog, DropdownMenu } from 'radix-ui';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Logo } from '../components/Logo';
import { IconButton } from '../components/ui/IconButton';
import { Menu, MenuContent, MenuLabel, MenuTrigger } from '../components/ui/Menu';
import { useCurrentMembership } from '../features/auth/currentUser';
import { useDesktopNotifications } from '../features/notifications/desktop';
import { useNotices } from '../features/notifications/notices';
import { PeriodPicker } from '../features/dashboard/PeriodPicker';
import { useMessages } from '../i18n';
import { common } from '../i18n/common';
import { cn } from '../lib/cn';
import { GlobalSearch } from './GlobalSearch';

/** The search on phones: the same search, full screen, opened from the top bar's search button. */
function SearchDialog() {
  const [open, setOpen] = useState(false);
  const m = useMessages(common).topBar;
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <IconButton label={m.searchLabel} size="md">
          <Search />
        </IconButton>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay data-[state=open]:animate-[fade-in_160ms_ease-out]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col bg-surface outline-none data-[state=open]:animate-[fade-in_160ms_ease-out]"
        >
          <Dialog.Title className="sr-only">{m.searchLabel}</Dialog.Title>
          <div className="flex min-h-0 flex-1 flex-col pt-[env(safe-area-inset-top)]">
            <div className="flex items-center justify-end px-4 pt-3">
              <Dialog.Close asChild>
                <IconButton label={m.search.close} size="md">
                  <X />
                </IconButton>
              </Dialog.Close>
            </div>
            <GlobalSearch variant="dialog" onDone={() => setOpen(false)} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
 * search (pages, budgets, categories and transactions, so it belongs on every
 * page) and notifications. On the dashboard it also carries the date range
 * the dashboard reports on.
 */
export function TopBar({ onOpenNavigation }: { onOpenNavigation: () => void }) {
  const location = useLocation();
  const m = useMessages(common);
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
      <div className="hidden min-w-0 flex-1 sm:block">
        <GlobalSearch />
      </div>
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {location.pathname === '/' && <PeriodPicker />}
        <span className="sm:hidden">
          <SearchDialog />
        </span>
        <Notifications />
      </div>
    </div>
  );
}
