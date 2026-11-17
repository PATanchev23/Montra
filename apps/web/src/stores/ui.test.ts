import { beforeEach, describe, expect, it } from 'vitest';
import indexHtml from '../../index.html?raw';
import { UI_STORAGE_KEY, UI_STORAGE_VERSION, useUiStore, type ThemePreference } from './ui';

/*
 * Version 1 of the saved preferences made light the default. Under version 0
 * dark was the default, so a saved "dark" may be a deliberate choice or just
 * the old default; the two cannot be told apart. The documented trade-off:
 * every pre-version-1 "dark" moves to light once, while "light" and "system",
 * which were always deliberate, are kept. Data with no version is read as
 * version 0.
 *
 * Two layers apply the rule: the store's migrate() and the script in
 * index.html that sets the theme before first paint. Each case below checks
 * the store after rehydration, what is written back, the pre-paint result
 * before and after the store has run, and a second load.
 */

type Saved = { version?: number; theme: ThemePreference } | null;

function save(saved: Saved) {
  localStorage.clear();
  if (!saved) return;
  localStorage.setItem(
    UI_STORAGE_KEY,
    JSON.stringify({
      ...(saved.version === undefined ? {} : { version: saved.version }),
      state: { theme: saved.theme, sidebarCollapsed: true, notifications: {} },
    }),
  );
}

const persisted = () => JSON.parse(localStorage.getItem(UI_STORAGE_KEY) ?? 'null');

/** The pre-paint script from index.html, run as the browser runs it, against the current storage. */
const prePaintScript = (() => {
  const script = /<script>([\s\S]*?)<\/script>/.exec(indexHtml)?.[1];
  if (!script) throw new Error('No inline theme script in index.html');
  return script;
})();

function prePaint(osPrefersDark = false): 'light' | 'dark' {
  const classes = new Set<string>();
  const documentStub = {
    documentElement: {
      classList: {
        toggle: (name: string, on: boolean) => void (on ? classes.add(name) : classes.delete(name)),
      },
    },
  };
  new Function('localStorage', 'matchMedia', 'document', prePaintScript)(
    localStorage,
    () => ({ matches: osPrefersDark }),
    documentStub,
  );
  return classes.has('dark') ? 'dark' : 'light';
}

/** Loads the store from what is saved, as a page load does after the pre-paint script. */
async function load() {
  // Reset without saving over the stored value: the store saves on every change.
  const stored = localStorage.getItem(UI_STORAGE_KEY);
  useUiStore.setState({ theme: 'light', sidebarCollapsed: false });
  if (stored === null) localStorage.removeItem(UI_STORAGE_KEY);
  else localStorage.setItem(UI_STORAGE_KEY, stored);
  await useUiStore.persist.rehydrate();
  return useUiStore.getState();
}

beforeEach(() => localStorage.clear());

describe('theme preference migration', () => {
  it('starts in light with nothing saved, and saves nothing until a choice is made', async () => {
    save(null);
    expect(prePaint()).toBe('light');
    expect((await load()).theme).toBe('light');
    expect(persisted()).toBeNull();
  });

  it.each([
    ['version 0', 0],
    ['no version', undefined],
  ])('moves a dark saved with %s to light once, chosen or not', async (_label, version) => {
    // Stored data cannot say whether this dark was chosen or the old default; both look like this.
    save({ version, theme: 'dark' });

    // First load: the first paint and the store agree on light.
    expect(prePaint()).toBe('light');
    const state = await load();
    expect(state.theme).toBe('light');
    expect(state.sidebarCollapsed).toBe(true);
    // Written back at the new version with the other preferences intact…
    expect(persisted()).toMatchObject({
      version: UI_STORAGE_VERSION,
      state: { theme: 'light', sidebarCollapsed: true },
    });

    // …so a reload paints light straight away and does not migrate again.
    expect(prePaint()).toBe('light');
    expect((await load()).theme).toBe('light');
    expect(persisted()).toMatchObject({ version: UI_STORAGE_VERSION, state: { theme: 'light' } });
  });

  it.each([
    ['system', 0, true, 'dark'],
    ['system', 0, false, 'light'],
    ['system', undefined, true, 'dark'],
    ['light', 0, true, 'light'],
    ['light', undefined, false, 'light'],
  ] as const)(
    'keeps an old %s (version %s, OS dark %s), which was always a choice',
    async (theme, version, osDark, painted) => {
      save({ version, theme });
      expect(prePaint(osDark)).toBe(painted);
      expect((await load()).theme).toBe(theme);
      expect(persisted()).toMatchObject({ version: UI_STORAGE_VERSION, state: { theme } });
      expect(prePaint(osDark)).toBe(painted);
    },
  );

  it('keeps dark saved at version 1, through reloads', async () => {
    save({ version: 1, theme: 'dark' });
    expect(prePaint()).toBe('dark');
    expect((await load()).theme).toBe('dark');
    expect(persisted()).toMatchObject({ version: 1, state: { theme: 'dark' } });

    expect(prePaint()).toBe('dark');
    expect((await load()).theme).toBe('dark');
  });

  it('remembers dark chosen after the migration, through a reload', async () => {
    save({ version: 0, theme: 'dark' });
    await load();
    useUiStore.getState().setTheme('dark');
    expect(persisted()).toMatchObject({ version: 1, state: { theme: 'dark' } });

    expect(prePaint()).toBe('dark');
    expect((await load()).theme).toBe('dark');
  });

  it('falls back to light when the saved data is unreadable', async () => {
    localStorage.setItem(UI_STORAGE_KEY, '{not json');
    expect(prePaint()).toBe('light');
    expect((await load()).theme).toBe('light');
  });
});
