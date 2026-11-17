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

/** Where the preferences live; index.html reads the same key before first paint. */
export const UI_STORAGE_KEY = 'montra-ui';

/** Version 1 made light the default theme. */
export const UI_STORAGE_VERSION = 1;

/**
 * localStorage as JSON, with saved data that carries no version read as
 * version 0. Every build has written a version, but persist would skip
 * migrate() for data without one; treating it as the oldest version keeps the
 * store and the pre-paint script in index.html on one rule.
 */
const storage = createJSONStorage<Partial<UiState>>(() => ({
  getItem: (name) => {
    const raw = localStorage.getItem(name);
    if (raw === null) return null;
    try {
      const saved = JSON.parse(raw) as { version?: unknown };
      return typeof saved.version === 'number' ? raw : JSON.stringify({ ...saved, version: 0 });
    } catch {
      return raw;
    }
  },
  setItem: (name, value) => localStorage.setItem(name, value),
  removeItem: (name) => localStorage.removeItem(name),
}));

/**
 * Client-only UI preferences. Server data never lives here — that belongs
 * to TanStack Query. The storage key is also read by index.html to apply the
 * theme before first paint.
 */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'light',
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
      name: UI_STORAGE_KEY,
      // A "dark" saved before version 1 cannot be told apart from the old dark default,
      // so it starts from light once; "light" and "system" were explicit choices and stay.
      // index.html applies the same rule before first paint.
      version: UI_STORAGE_VERSION,
      migrate: (persisted, version): Partial<UiState> => {
        const state = (persisted ?? {}) as Partial<UiState>;
        return version < 1 && state.theme === 'dark' ? { ...state, theme: 'light' } : state;
      },
      storage,
      partialize: ({ theme, sidebarCollapsed, notifications }) => ({
        theme,
        sidebarCollapsed,
        notifications,
      }),
    },
  ),
);
