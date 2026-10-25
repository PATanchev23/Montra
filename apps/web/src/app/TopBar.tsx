import { Bell, CalendarDays, ChevronDown, FlaskConical, Menu as MenuIcon } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { describePeriod, listPeriods, useNotifications } from '../api/finance';
import { Logo } from '../components/Logo';
import { Badge } from '../components/ui/Badge';
import { IconButton } from '../components/ui/IconButton';
import { SearchField } from '../components/ui/Input';
import {
  Menu,
  MenuContent,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from '../components/ui/Menu';
import { Tooltip } from '../components/ui/Tooltip';
import { cn } from '../lib/cn';
import { useUiStore } from '../stores/ui';

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
    <form role="search" onSubmit={submit} className="min-w-0 flex-1">
      <SearchField
        ref={inputRef}
        value={value}
        onValueChange={setValue}
        placeholder="Search transactions, suppliers, categories…"
        aria-label="Search transactions"
        className="[&_input]:h-11 [&_input]:rounded-[12px] [&_input]:bg-surface [&_input]:text-[14px]"
        trailing={
          <kbd className="hidden h-5 items-center rounded-md border border-line px-1.5 font-mono text-[11px] text-faint sm:flex">
            /
          </kbd>
        }
      />
    </form>
  );
}

function PeriodPicker() {
  const period = useUiStore((s) => s.period);
  const setPeriod = useUiStore((s) => s.setPeriod);
  const info = describePeriod(period);
  const options = listPeriods(period.unit, period.unit === 'year' ? 2 : 6);

  return (
    <Menu>
      <MenuTrigger
        className="flex h-11 cursor-pointer items-center gap-3 rounded-[12px] border border-line bg-surface px-3.5 text-[13px] text-ink transition-colors hover:border-line-strong data-[state=open]:border-line-strong"
        aria-label={`Reporting period: ${info.label}`}
      >
        <CalendarDays className="size-[18px] text-muted" strokeWidth={1.6} />
        <span className="tabular hidden whitespace-nowrap lg:inline">{info.rangeLabel}</span>
        <span className="whitespace-nowrap lg:hidden">{info.label}</span>
        <ChevronDown className="size-4 text-muted" strokeWidth={1.75} />
      </MenuTrigger>
      <MenuContent className="w-64">
        <MenuLabel>Reporting period</MenuLabel>
        <MenuRadioGroup
          value={String(period.offset)}
          onValueChange={(offset) => setPeriod({ ...period, offset: Number(offset) })}
        >
          {options.map((option) => (
            <MenuRadioItem
              key={option.period.offset}
              value={String(option.period.offset)}
              hint={option.rangeLabel}
            >
              {option.label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

const toneDot = { neutral: 'bg-chart-1', warning: 'bg-warning', negative: 'bg-negative' } as const;

function Notifications() {
  const navigate = useNavigate();
  const { data = [] } = useNotifications();

  return (
    <Menu>
      <MenuTrigger asChild>
        <IconButton label="Notifications" bordered className="size-11 rounded-[12px] bg-surface">
          <Bell strokeWidth={1.6} />
          {data.length > 0 && (
            <span className="absolute top-2.5 right-2.5 size-2 rounded-full border-2 border-surface bg-chart-1" />
          )}
        </IconButton>
      </MenuTrigger>
      <MenuContent className="w-80 p-1.5">
        <MenuLabel>Notifications</MenuLabel>
        {data.map((n) => (
          <DropdownMenu.Item
            key={n.id}
            onSelect={() => navigate(n.to)}
            className="flex cursor-pointer gap-3 rounded-lg px-2.5 py-2.5 outline-none data-[highlighted]:bg-hover"
          >
            <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', toneDot[n.tone])} />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] leading-snug font-medium text-ink">{n.title}</span>
              <span className="block text-[12px] leading-snug text-muted">{n.body}</span>
            </span>
            <span className="shrink-0 text-[11px] text-faint">{n.time}</span>
          </DropdownMenu.Item>
        ))}
      </MenuContent>
    </Menu>
  );
}

export function TopBar({ onOpenNavigation }: { onOpenNavigation: () => void }) {
  return (
    <div className="flex items-center gap-3 lg:gap-4">
      <IconButton label="Open navigation" className="lg:hidden" onClick={onOpenNavigation}>
        <MenuIcon />
      </IconButton>
      <span className="mr-1 sm:hidden">
        <Logo collapsed />
      </span>
      <div className="hidden min-w-0 flex-1 sm:block">
        <GlobalSearch />
      </div>
      <div className="ml-auto flex items-center gap-3">
        <Tooltip content="Figures are deterministic TechStore sample data. Live data arrives with the financial API.">
          <span tabIndex={0} className="hidden rounded-full xl:inline-flex">
            <Badge tone="analytic">
              <FlaskConical className="size-3" strokeWidth={2} />
              Sample data
            </Badge>
          </span>
        </Tooltip>
        <PeriodPicker />
        <Notifications />
      </div>
    </div>
  );
}
