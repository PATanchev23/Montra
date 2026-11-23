import {
  Activity,
  Check,
  ChevronRight,
  Languages,
  ChevronsUpDown,
  LogOut,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sparkles,
  Sun,
} from 'lucide-react';
import type { MembershipRole } from '@montra/shared';
import { useState } from 'react';
import { NavLink, useMatch, useNavigate } from 'react-router';
import { useLogout } from '../api/auth';
import { Logo } from '../components/Logo';
import { Badge } from '../components/ui/Badge';
import { IconButton } from '../components/ui/IconButton';
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from '../components/ui/Menu';
import { Tooltip } from '../components/ui/Tooltip';
import { useSignedInUser } from '../features/auth/currentUser';
import { plansMessages } from '../features/plans/messages';
import { CURRENT_PLAN } from '../features/plans/plans';
import { PlansDialog, PlansDialogTrigger } from '../features/plans/PlansDialog';
import { LANGUAGE_NAMES, LANGUAGES, useLanguage, useMessages } from '../i18n';
import { common } from '../i18n/common';
import { cn } from '../lib/cn';
import { useUiStore, type ThemePreference } from '../stores/ui';
import { primaryNav, secondaryNav, type NavItem } from './navigation';

function SidebarLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const label = useMessages(common).nav[item.label];
  // A plain class string, not NavLink's function form: the collapsed rail wraps the
  // link in a tooltip trigger, which can only merge strings.
  const isActive = useMatch({ path: item.to, end: item.to === '/' }) !== null;
  const link = (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onNavigate}
      aria-label={collapsed ? label : undefined}
      className={cn(
        'group flex h-11 items-center gap-3.5 rounded-control text-body transition-colors duration-150',
        collapsed ? 'justify-center px-0' : 'px-3.5',
        // The page you are on is the one ink pill in the rail.
        isActive
          ? 'bg-accent font-medium text-accent-ink'
          : 'text-ink-2 hover:bg-hover hover:text-ink',
      )}
    >
      <Icon aria-hidden className="size-[18px] shrink-0" strokeWidth={1.75} />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );
  return collapsed ? (
    <Tooltip content={label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}

const themes: { value: ThemePreference; label: 'light' | 'dark' | 'system'; icon: typeof Sun }[] = [
  { value: 'light', label: 'light', icon: Sun },
  { value: 'dark', label: 'dark', icon: Moon },
  { value: 'system', label: 'system', icon: Monitor },
];

const roleLabels = { OWNER: 'owner', VIEWER: 'viewer' } as const satisfies Record<
  MembershipRole,
  string
>;

function AccountMenu({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate();
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const language = useLanguage();
  const setLanguage = useUiStore((s) => s.setLanguage);
  const m = useMessages(common);
  const plans = useMessages(plansMessages);
  const { user } = useSignedInUser();
  const logout = useLogout();

  return (
    <Menu>
      <MenuTrigger
        className={cn(
          'flex w-full cursor-pointer items-center gap-3 rounded-field p-2 text-left transition-colors hover:bg-hover data-[state=open]:bg-hover',
          collapsed && 'justify-center',
        )}
        aria-label={m.account.menu}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-hover text-body-sm font-medium text-ink">
          {user.name[0]}
        </span>
        {!collapsed && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body-sm font-medium text-ink">{user.name}</span>
            <span className="block truncate text-caption text-muted">{user.email}</span>
          </span>
        )}
        {!collapsed && (
          <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-muted" strokeWidth={1.75} />
        )}
      </MenuTrigger>
      <MenuContent side="top" align="start" className="w-60">
        <MenuLabel>{m.account.appearance}</MenuLabel>
        {themes.map(({ value, label, icon: Icon }) => (
          <MenuItem key={value} onSelect={() => setTheme(value)}>
            <Icon />
            {m.account[label]}
            {theme === value && <Check className="ml-auto !text-ink" strokeWidth={2.25} />}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuLabel>{m.account.language}</MenuLabel>
        {LANGUAGES.map((value) => (
          <MenuItem key={value} lang={value} onSelect={() => setLanguage(value)}>
            <Languages />
            {LANGUAGE_NAMES[value]}
            {language === value && <Check className="ml-auto !text-ink" strokeWidth={2.25} />}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem onSelect={() => navigate('/settings')}>
          <Settings />
          {m.nav.settings}
        </MenuItem>
        <MenuItem onSelect={() => navigate('/plans')}>
          <Sparkles />
          {plans.title}
        </MenuItem>
        <MenuItem onSelect={() => navigate('/status')}>
          <Activity />
          {m.nav.status}
        </MenuItem>
        <MenuSeparator />
        <MenuItem disabled={logout.isPending} onSelect={() => logout.mutate()}>
          <LogOut />
          {m.account.signOut}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

/** Upgrade, with the plan the account is on; opens the plans dialog. */
function UpgradeButton({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const m = useMessages(plansMessages);
  // The dialog's own trigger, so focus comes back here when it closes.
  const button = (
    <PlansDialogTrigger
      aria-label={collapsed ? m.upgrade : undefined}
      className={cn(
        'flex h-11 w-full cursor-pointer items-center gap-3.5 rounded-control text-body text-ink-2 transition-colors duration-150 hover:bg-hover hover:text-ink',
        collapsed ? 'justify-center px-0' : 'px-3.5',
      )}
    >
      <Sparkles aria-hidden className="size-[18px] shrink-0" strokeWidth={1.75} />
      {!collapsed && (
        <>
          <span className="flex-1 truncate text-left">{m.upgrade}</span>
          <Badge>{m.names[CURRENT_PLAN]}</Badge>
        </>
      )}
    </PlansDialogTrigger>
  );
  return (
    <PlansDialog open={open} onOpenChange={setOpen} onNavigate={onNavigate}>
      {collapsed ? (
        <Tooltip content={m.upgrade} side="right">
          {button}
        </Tooltip>
      ) : (
        button
      )}
    </PlansDialog>
  );
}

/**
 * The navigation plane: the mark, the destinations in one list, system pages
 * beneath a rule, then the business this session works in and the account at
 * the foot. Collapsed, it is an icon rail with labels in tooltips.
 */
export function Sidebar({
  collapsed = false,
  onToggle,
  onNavigate,
  className,
}: {
  collapsed?: boolean;
  /** Present only where the reader can choose; narrower screens keep the rail. */
  onToggle?: () => void;
  onNavigate?: () => void;
  className?: string;
}) {
  const [membership] = useSignedInUser().memberships;
  const m = useMessages(common);

  return (
    <div className={cn('flex h-full flex-col px-4 pt-6 pb-4', collapsed && 'px-3.5', className)}>
      <div
        className={cn(
          'flex h-11 items-center justify-between pl-2',
          collapsed && 'h-auto flex-col gap-3 pl-0',
        )}
      >
        <Logo collapsed={collapsed} />
        {onToggle && (
          <IconButton
            label={collapsed ? m.nav.expandSidebar : m.nav.collapseSidebar}
            size="sm"
            onClick={onToggle}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </IconButton>
        )}
      </div>

      <nav aria-label={m.nav.primary} className="mt-8 flex flex-col gap-1">
        {primaryNav.map((item) => (
          <SidebarLink key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </nav>

      <nav
        aria-label={m.nav.secondary}
        className="mt-6 flex flex-col gap-1 border-t border-line pt-6"
      >
        {secondaryNav.map((item) => (
          <SidebarLink key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3 pt-6">
        <UpgradeButton collapsed={collapsed} onNavigate={onNavigate} />
        {!collapsed && membership && (
          <NavLink
            to="/settings#business"
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-field border border-line bg-surface px-3.5 py-3 shadow-panel transition-colors hover:border-line-strong"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body-sm font-medium text-ink">
                {membership.business.name}
              </span>
              <span className="tabular block truncate text-caption text-muted">
                {m.account[roleLabels[membership.role]]} · {membership.business.currency}
              </span>
            </span>
            <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" strokeWidth={1.75} />
          </NavLink>
        )}
        <AccountMenu collapsed={collapsed} />
      </div>
    </div>
  );
}
