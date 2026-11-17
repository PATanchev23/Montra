import { Bell, FlaskConical, Menu as MenuIcon, Search } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useNotifications } from '../api/finance';
import { Logo } from '../components/Logo';
import { IconButton } from '../components/ui/IconButton';
import { SearchField } from '../components/ui/Input';
import { Menu, MenuContent, MenuLabel, MenuTrigger } from '../components/ui/Menu';
import { Tooltip } from '../components/ui/Tooltip';
import { PeriodPicker } from '../features/dashboard/PeriodPicker';
import { cn } from '../lib/cn';

function GlobalSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

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
        placeholder="Search transactions, suppliers, categories…"
        aria-label="Search transactions"
        trailing={
          <kbd className="hidden h-6 min-w-6 items-center justify-center rounded-md border border-line-strong px-1.5 font-mono text-caption text-muted sm:flex">
            /
          </kbd>
        }
      />
    </form>
  );
}

const toneDot = { neutral: 'bg-ink-2', warning: 'bg-warning', negative: 'bg-negative' } as const;

function Notifications() {
  const navigate = useNavigate();
  const { data = [] } = useNotifications();

  return (
    <Menu>
      <MenuTrigger asChild>
        <IconButton label="Notifications" size="lg" bordered>
          <Bell strokeWidth={1.6} />
          {data.length > 0 && (
            <span className="absolute top-2.5 right-2.5 size-2 rounded-full border-2 border-raised bg-ink" />
          )}
        </IconButton>
      </MenuTrigger>
      <MenuContent className="w-80">
        <MenuLabel>Notifications</MenuLabel>
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

/** Pages whose figures come from the API; the sample-data marker stays off them. */
const LIVE_DATA_PATHS = ['/', '/transactions', '/status'];

const SAMPLE_NOTE =
  'Figures on this page are deterministic TechStore sample data. Live data arrives with the financial API.';

/**
 * Marks pages that still show sample data, at every width: a labelled badge
 * from 1280px, the same mark as an icon below it.
 */
function SampleDataMarker() {
  return (
    <Tooltip content={SAMPLE_NOTE}>
      <span
        tabIndex={0}
        aria-label={`Sample data. ${SAMPLE_NOTE}`}
        className="inline-flex h-8 items-center gap-1.5 rounded-full bg-hover px-2.5 text-caption font-medium text-ink-2 xl:px-3"
      >
        <FlaskConical aria-hidden className="size-3.5" strokeWidth={2} />
        <span className="hidden xl:inline">Sample data</span>
      </span>
    </Tooltip>
  );
}

/**
 * One line above every page: navigation access where the sidebar is hidden,
 * search, the sample-data mark and notifications. On the dashboard it also
 * carries the date range the dashboard reports on.
 */
export function TopBar({ onOpenNavigation }: { onOpenNavigation: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <div className="flex h-[72px] items-center gap-3 sm:gap-4">
      <IconButton
        label="Open navigation"
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
        {!LIVE_DATA_PATHS.includes(location.pathname) && <SampleDataMarker />}
        {location.pathname === '/' && <PeriodPicker />}
        <IconButton
          label="Search transactions"
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
