import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { DashboardParams } from '../api/dashboard';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface NotificationPrefs {
  dueReminders: boolean;
  budgetAlerts: boolean;
  weeklySummary: boolean;
  lowBalance: boolean;
}

interface UiState {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;

  /** The reporting period shared by the dashboard and the top bar. */
  period: DashboardParams;
  setPeriod: (period: DashboardParams) => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  notifications: NotificationPrefs;
  setNotification: (key: keyof NotificationPrefs, value: boolean) => void;
}

/**
 * Client-only UI preferences. Server data never lives here — that belongs
 * to TanStack Query. The storage key is also read by index.html to apply the
 * theme before first paint.
 */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => set({ theme }),

      period: { period: '30d' },
      setPeriod: (period) => set({ period }),

      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      notifications: {
        dueReminders: true,
        budgetAlerts: true,
        weeklySummary: false,
        lowBalance: true,
      },
      setNotification: (key, value) =>
        set((s) => ({ notifications: { ...s.notifications, [key]: value } })),
    }),
    {
      name: 'montra-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ theme, sidebarCollapsed, notifications }) => ({
        theme,
        sidebarCollapsed,
        notifications,
      }),
    },
  ),
);
