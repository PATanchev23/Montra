import { motion } from 'motion/react';
import { useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { Sheet } from '../components/ui/Sheet';
import { cn } from '../lib/cn';
import { useUiStore } from '../stores/ui';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function AppShell() {
  const location = useLocation();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
          'no-print hidden shrink-0 border-r border-line bg-sidebar transition-[width] duration-300 ease-[var(--ease-out-soft)] lg:block',
          collapsed ? 'w-[84px]' : 'w-[264px]',
        )}
      >
        <div className="sticky top-0 h-dvh">
          <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
        </div>
      </aside>

      <Sheet
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        title="Navigation"
        side="left"
        hideTitle
        className="bg-sidebar"
      >
        <Sidebar onNavigate={() => setMobileNavOpen(false)} />
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print px-4 pt-5 sm:px-6 lg:px-8 lg:pt-6">
          <div className="mx-auto max-w-[1440px]">
            <TopBar onOpenNavigation={() => setMobileNavOpen(true)} />
          </div>
        </header>

        <motion.main
          id="main"
          key={location.pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto w-full max-w-[1440px] px-4 pt-7 pb-12 sm:px-6 lg:px-8 lg:pt-8"
        >
          <Outlet />
        </motion.main>
      </div>
    </div>
  );
}
