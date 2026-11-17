import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import indexHtml from '../../index.html?raw';
import { UI_STORAGE_KEY, UI_STORAGE_VERSION, useUiStore } from '../stores/ui';
import { detectLanguage } from './language';

/*
 * The interface language is chosen in this order: the saved choice, else
 * Bulgarian for a browser that asks for Bulgarian first, else English. Two
 * layers apply the rule: the preferences store, and the script in index.html
 * that sets <html lang> before first paint.
 */

function browserLanguage(language: string) {
  vi.spyOn(navigator, 'language', 'get').mockReturnValue(language);
}

function save(state: Record<string, unknown> | null) {
  localStorage.clear();
  if (state) {
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify({ version: UI_STORAGE_VERSION, state }));
  }
}

/** The pre-paint script from index.html, run as the browser runs it; returns the lang it sets. */
function prePaintLang(): string {
  const script = /<script>([\s\S]*?)<\/script>/.exec(indexHtml)?.[1];
  if (!script) throw new Error('No inline pre-paint script in index.html');
  const documentElement = { lang: '', classList: { toggle: () => {} } };
  new Function('localStorage', 'matchMedia', 'document', 'navigator', script)(
    localStorage,
    () => ({ matches: false }),
    { documentElement },
    navigator,
  );
  return documentElement.lang;
}

/** Loads the store from what is saved, as a page load does. */
async function load(detected: 'en' | 'bg' = 'en') {
  const stored = localStorage.getItem(UI_STORAGE_KEY);
  useUiStore.setState({ language: detected });
  if (stored === null) localStorage.removeItem(UI_STORAGE_KEY);
  else localStorage.setItem(UI_STORAGE_KEY, stored);
  await useUiStore.persist.rehydrate();
  return useUiStore.getState().language;
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  useUiStore.setState({ language: 'en' });
});

describe('detecting the language', () => {
  it.each([
    ['bg-BG', 'bg'],
    ['bg', 'bg'],
    ['BG', 'bg'],
    ['en-US', 'en'],
    ['de-DE', 'en'],
    ['', 'en'],
  ] as const)('reads a browser asking for "%s" as %s', (browser, expected) => {
    browserLanguage(browser);
    expect(detectLanguage()).toBe(expected);
  });
});

describe('remembering the language', () => {
  it('follows the browser while nothing is saved', async () => {
    browserLanguage('bg-BG');
    save(null);
    expect(prePaintLang()).toBe('bg');
    expect(await load('bg')).toBe('bg');
  });

  it('keeps a saved choice over the browser’s, through reloads', async () => {
    browserLanguage('bg-BG');
    save({ theme: 'light', language: 'en' });
    expect(prePaintLang()).toBe('en');
    expect(await load('bg')).toBe('en');
    expect(await load('bg')).toBe('en');
  });

  it('saves a choice made in the app', async () => {
    browserLanguage('en-US');
    save(null);
    await load();
    useUiStore.getState().setLanguage('bg');
    expect(JSON.parse(localStorage.getItem(UI_STORAGE_KEY)!).state.language).toBe('bg');
    expect(prePaintLang()).toBe('bg');
    expect(await load('en')).toBe('bg');
  });

  it('keeps the detected language for preferences saved before languages existed', async () => {
    browserLanguage('bg-BG');
    save({ theme: 'dark', sidebarCollapsed: true, notifications: {} });
    expect(prePaintLang()).toBe('bg');
    expect(await load('bg')).toBe('bg');
    // The rest of the saved preferences still load.
    expect(useUiStore.getState().theme).toBe('dark');
  });

  it('ignores a saved language Montra does not offer', async () => {
    browserLanguage('en-US');
    save({ theme: 'light', language: 'fr' });
    expect(prePaintLang()).toBe('en');
    expect(await load('en')).toBe('en');
  });
});
