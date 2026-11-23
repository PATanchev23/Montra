import type { ScenarioPresetId, ScenarioRule } from '@montra/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { DashboardParams } from '../api/dashboard';
import { detectLanguage, isLanguage, type Language } from '../i18n/language';

/**
 * A business's scenario list as the user shaped it: suggestions added from
 * "New scenario" (newest first), ready-made ones taken off the list, and the
 * one the user built, so each stays put while another is viewed.
 */
export interface ScenarioChoices {
  added: ScenarioPresetId[];
  removed: ScenarioPresetId[];
  custom?: ScenarioRule;
}

export const NO_SCENARIO_CHOICES: ScenarioChoices = { added: [], removed: [] };

export type ThemePreference = 'system' | 'light' | 'dark';

export interface NotificationPrefs {
  /** Also show alerts in the computer's notification area (the browser must allow it). */
  desktop: boolean;
  dueReminders: boolean;
  budgetAlerts: boolean;
  weeklySummary: boolean;
  lowBalance: boolean;
}

interface UiState {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;

  /** The interface language. index.html also reads it to set <html lang> before first paint. */
  language: Language;
  setLanguage: (language: Language) => void;

  /** The reporting period shared by the dashboard and the top bar. */
  period: DashboardParams;
  setPeriod: (period: DashboardParams) => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  notifications: NotificationPrefs;
  setNotification: (key: keyof NotificationPrefs, value: boolean) => void;

  /** Each business's scenario list, by business id. */
  scenarios: Record<string, ScenarioChoices>;
  addScenario: (businessId: string, id: ScenarioPresetId) => void;
  /** Takes a ready-made scenario off the list, or forgets the user's own ('custom'). */
  removeScenario: (businessId: string, id: ScenarioPresetId | 'custom') => void;
  saveCustomScenario: (businessId: string, rule: ScenarioRule) => void;
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

      language: detectLanguage(),
      setLanguage: (language) => set({ language }),

      period: { period: '30d' },
      setPeriod: (period) => set({ period }),

      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      notifications: {
        desktop: false,
        dueReminders: true,
        budgetAlerts: true,
        weeklySummary: false,
        lowBalance: true,
      },
      setNotification: (key, value) =>
        set((s) => ({ notifications: { ...s.notifications, [key]: value } })),

      scenarios: {},
      addScenario: (businessId, id) =>
        set((s) => {
          const c = s.scenarios[businessId] ?? NO_SCENARIO_CHOICES;
          const added = [id, ...c.added.filter((a) => a !== id)];
          const removed = c.removed.filter((r) => r !== id);
          return { scenarios: { ...s.scenarios, [businessId]: { ...c, added, removed } } };
        }),
      removeScenario: (businessId, id) =>
        set((s) => {
          const c = s.scenarios[businessId] ?? NO_SCENARIO_CHOICES;
          const next: ScenarioChoices =
            id === 'custom'
              ? { added: c.added, removed: c.removed }
              : {
                  ...c,
                  added: c.added.filter((a) => a !== id),
                  removed: c.removed.includes(id) ? c.removed : [...c.removed, id],
                };
          return { scenarios: { ...s.scenarios, [businessId]: next } };
        }),
      saveCustomScenario: (businessId, rule) =>
        set((s) => {
          const c = s.scenarios[businessId] ?? NO_SCENARIO_CHOICES;
          return { scenarios: { ...s.scenarios, [businessId]: { ...c, custom: rule } } };
        }),
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
      // Saved data from before languages existed has no language; it keeps the detected one.
      // An unknown saved value (hand-edited, or a language since removed) is ignored too.
      // Notification switches added later (desktop) keep their default under older saved ones.
      merge: (persisted, current) => {
        const { language, notifications, ...rest } = (persisted ?? {}) as Partial<UiState>;
        return {
          ...current,
          ...rest,
          notifications: { ...current.notifications, ...notifications },
          ...(isLanguage(language) && { language }),
        };
      },
      storage,
      partialize: ({ theme, language, sidebarCollapsed, notifications, scenarios }) => ({
        theme,
        language,
        sidebarCollapsed,
        notifications,
        scenarios,
      }),
    },
  ),
);
