import { motion } from 'motion/react';
import { useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { Sheet } from '../components/ui/Sheet';
import { cn } from '../lib/cn';
import { useMediaQuery } from '../lib/useMediaQuery';
import { useUiStore } from '../stores/ui';
import { MobileTabBar } from './MobileTabBar';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

/**
 * The frame around every signed-in page.
 *
 *   ≥1280   full sidebar (the reader may collapse it to a rail)
 *   1024+   icon rail, so the content keeps its width
 *   640+    no sidebar; the top bar opens the navigation sheet
 *   <640    bottom tab bar; More opens the same sheet
 */
export function AppShell() {
  const location = useLocation();
  const preferCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const wide = useMediaQuery('(min-width: 1280px)');
  const collapsed = wide ? preferCollapsed : true;
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-control bg-accent px-3 py-2 text-accent-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <aside
        className={cn(
          'no-print hidden shrink-0 border-r border-line bg-sidebar transition-[width] duration-200 ease-[var(--ease-out-soft)] lg:block',
          collapsed ? 'w-[76px]' : 'w-[248px]',
        )}
      >
        <div className="sticky top-0 h-dvh">
          <Sidebar collapsed={collapsed} onToggle={wide ? toggleSidebar : undefined} />
        </div>
      </aside>

      <Sheet
        open={navOpen}
        onOpenChange={setNavOpen}
        title="Navigation"
        side="left"
        hideTitle
        className="bg-sidebar"
      >
        <Sidebar onNavigate={() => setNavOpen(false)} />
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 bg-canvas px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1440px]">
            <TopBar onOpenNavigation={() => setNavOpen(true)} />
          </div>
        </header>

        <motion.main
          id="main"
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="pb-tabbar mx-auto w-full max-w-[1440px] px-4 pt-2 sm:px-6 sm:pb-12 lg:px-8 lg:pt-3"
        >
          <Outlet />
        </motion.main>
      </div>

      <MobileTabBar onOpenMore={() => setNavOpen(true)} />
    </div>
  );
}
