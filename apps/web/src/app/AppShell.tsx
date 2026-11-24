import { motion } from 'motion/react';
import { useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { Sheet } from '../components/ui/Sheet';
import { useMessages } from '../i18n';
import { common } from '../i18n/common';
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
  const m = useMessages(common);

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-control bg-accent px-3 py-2 text-accent-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {m.nav.skipToContent}
      </a>

      <aside
        className={cn(
          'no-print hidden shrink-0 border-r border-line bg-sidebar transition-[width] duration-[var(--duration-slow)] ease-[var(--ease-standard)] lg:block',
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
        title={m.nav.navigation}
        side="left"
        hideTitle
        className="bg-sidebar"
      >
        <Sidebar onNavigate={() => setNavOpen(false)} />
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* The bar lets scrolled content show through faintly, so the page reads as one continuous plane. */}
        <header className="no-print sticky top-0 z-20 bg-bar px-gutter backdrop-blur-xl backdrop-saturate-150 sm:px-gutter-md xl:px-gutter-lg">
          <div className="mx-auto max-w-[1440px]">
            <TopBar onOpenNavigation={() => setNavOpen(true)} />
          </div>
        </header>

        <motion.main
          id="main"
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
          className="pb-tabbar mx-auto w-full max-w-[1440px] px-gutter pt-4 sm:px-gutter-md sm:pb-16 xl:px-gutter-lg"
        >
          <Outlet />
        </motion.main>
      </div>

      <MobileTabBar onOpenMore={() => setNavOpen(true)} />
    </div>
  );
}
