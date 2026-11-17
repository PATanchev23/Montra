import { useSyncExternalStore } from 'react';

/**
 * Whether a CSS media query matches, kept in sync as the window changes.
 * Server-free app, so the first render reads `matchMedia` directly; where it
 * does not exist (tests, old engines) the query counts as matching, which
 * keeps the default desktop layout.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : true),
  );
}
