import { Ellipsis } from 'lucide-react';
import { NavLink } from 'react-router';
import { useMessages } from '../i18n';
import { common } from '../i18n/common';
import { cn } from '../lib/cn';
import { tabBarNav, type NavItem } from './navigation';

const tabClass =
  'relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] leading-none font-medium transition-colors';

function Tab({ item }: { item: NavItem }) {
  const m = useMessages(common);
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(tabClass, isActive ? 'text-ink' : 'text-muted hover:text-ink-2')
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span aria-hidden className="absolute top-0 h-0.5 w-6 rounded-full bg-accent" />
          )}
          <Icon aria-hidden className="size-5" strokeWidth={isActive ? 2 : 1.75} />
          {m.nav[item.tabLabel ?? item.label]}
        </>
      )}
    </NavLink>
  );
}

/**
 * Phone navigation (below 640px): the four destinations used most, and More
 * for everything else, which opens the full navigation sheet. Each target is
 * at least 64px tall and the bar clears the home indicator.
 */
export function MobileTabBar({ onOpenMore }: { onOpenMore: () => void }) {
  const m = useMessages(common);
  return (
    <nav
      aria-label={m.nav.primary}
      className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <div className="grid grid-cols-5">
        {tabBarNav.map((item) => (
          <Tab key={item.to} item={item} />
        ))}
        <button
          type="button"
          onClick={onOpenMore}
          className={cn(tabClass, 'cursor-pointer text-muted hover:text-ink-2')}
        >
          <Ellipsis aria-hidden className="size-5" strokeWidth={1.75} />
          {m.nav.more}
        </button>
      </div>
    </nav>
  );
}
