import {
  Activity,
  Check,
  ChevronRight,
  LogOut,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Store,
  Sun,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { MembershipRole } from '@montra/shared';
import { NavLink, useNavigate } from 'react-router';
import { useLogout } from '../api/auth';
import { Logo } from '../components/Logo';
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
  const link = (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group relative flex h-11 items-center gap-3.5 rounded-control text-[14px] transition-colors duration-150',
          collapsed ? 'justify-center px-0' : 'px-4',
          isActive ? 'font-medium text-ink' : 'text-ink-2 hover:bg-hover hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="sidebar-active"
              className="absolute inset-0 rounded-control border border-accent-line bg-accent-soft"
              transition={{ type: 'spring', stiffness: 520, damping: 44 }}
            />
          )}
          <Icon
            className={cn(
              'relative size-5 shrink-0',
              isActive ? 'text-accent' : 'text-muted group-hover:text-ink-2',
            )}
            strokeWidth={1.6}
          />
          {!collapsed && <span className="relative truncate">{item.label}</span>}
        </>
      )}
    </NavLink>
  );
  return collapsed ? (
    <Tooltip content={item.label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}

const themes: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'System', icon: Monitor },
];

const roleLabels: Record<MembershipRole, string> = { OWNER: 'Owner', VIEWER: 'Viewer' };

function AccountMenu({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate();
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const { user } = useSignedInUser();
  const logout = useLogout();

  return (
    <Menu>
      <MenuTrigger
        className={cn(
          'flex w-full cursor-pointer items-center gap-3 rounded-control p-2 text-left transition-colors hover:bg-hover data-[state=open]:bg-hover',
          collapsed && 'justify-center',
        )}
        aria-label="Account and appearance"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line-strong bg-raised text-[14px] font-medium text-ink-2">
          {user.name[0]}
        </span>
        {!collapsed && (
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[13px] font-medium text-ink">{user.name}</span>
            <span className="block truncate text-[12px] text-muted">{user.email}</span>
          </span>
        )}
        {!collapsed && <Settings className="size-4 shrink-0 text-muted" strokeWidth={1.75} />}
      </MenuTrigger>
      <MenuContent side="top" align="start" className="w-60">
        <MenuLabel>Appearance</MenuLabel>
        {themes.map(({ value, label, icon: Icon }) => (
          <MenuItem key={value} onSelect={() => setTheme(value)}>
            <Icon />
            {label}
            {theme === value && <Check className="ml-auto !text-accent" strokeWidth={2.25} />}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem onSelect={() => navigate('/settings')}>
          <Settings />
          Settings
        </MenuItem>
        <MenuItem onSelect={() => navigate('/status')}>
          <Activity />
          System status
        </MenuItem>
        <MenuSeparator />
        <MenuItem disabled={logout.isPending} onSelect={() => logout.mutate()}>
          <LogOut />
          Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

export function Sidebar({
  collapsed = false,
  onToggle,
  onNavigate,
  className,
}: {
  collapsed?: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
  className?: string;
}) {
  const [membership] = useSignedInUser().memberships;

  return (
    <div className={cn('flex h-full flex-col px-4 pt-6 pb-4', collapsed && 'px-3', className)}>
      <div
        className={cn('flex items-center justify-between pl-2', collapsed && 'flex-col gap-4 pl-0')}
      >
        <Logo collapsed={collapsed} />
        {onToggle && (
          <IconButton
            label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            size="sm"
            onClick={onToggle}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </IconButton>
        )}
      </div>

      <nav aria-label="Primary" className="mt-9 flex flex-col gap-1.5">
        {primaryNav.map((item) => (
          <SidebarLink key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="mt-6 border-t border-line pt-6">
        <nav aria-label="Secondary" className="flex flex-col gap-1.5">
          {secondaryNav.map((item) => (
            <SidebarLink key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </nav>
      </div>

      <div className="mt-auto flex flex-col gap-3 pt-6">
        {!collapsed && membership && (
          <NavLink
            to="/settings#business"
            onClick={onNavigate}
            className="group flex items-center gap-3 rounded-panel border border-line bg-surface p-3 transition-colors hover:border-line-strong"
          >
            <span className="flex size-9 items-center justify-center rounded-[10px] bg-positive-soft text-positive">
              <Store className="size-[18px]" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13px] font-medium text-ink">
                {membership.business.name}
              </span>
              <span className="block truncate text-[12px] text-muted">
                {roleLabels[membership.role]} · {membership.business.currency}
              </span>
            </span>
            <ChevronRight
              className="size-4 text-muted transition-transform group-hover:translate-x-0.5"
              strokeWidth={1.75}
            />
          </NavLink>
        )}
        <AccountMenu collapsed={collapsed} />
      </div>
    </div>
  );
}
