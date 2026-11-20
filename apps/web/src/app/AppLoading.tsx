import { useLayoutEffect, useSyncExternalStore } from 'react';
import { LogoMark } from '../components/Logo';
import { useMessages } from '../i18n';
import { common } from '../i18n/common';
import { cn } from '../lib/cn';

/** The logo stays up at least this long once shown, so it reads rather than flickers. */
const MIN_VISIBLE_MS = 900;
/** Then it fades out over this long. */
const FADE_MS = 240;

type Veil = 'hidden' | 'loading' | 'holding' | 'leaving';

/*
 * The loading screens unmount the moment their data arrives, often within a
 * frame or two. The logo is therefore drawn by one veil at the app root, which
 * every AppLoading keeps up while mounted and which outlasts them briefly.
 */
let state: Veil = 'hidden';
let mounted = 0;
let shownAt = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function set(next: Veil) {
  state = next;
  for (const listener of listeners) listener();
}

function acquire() {
  mounted += 1;
  clearTimeout(timer);
  if (state === 'hidden' || state === 'leaving') shownAt = Date.now();
  set('loading');
}

function release() {
  mounted -= 1;
  if (mounted > 0) return;
  set('holding');
  timer = setTimeout(
    () => {
      set('leaving');
      timer = setTimeout(() => set('hidden'), FADE_MS);
    },
    Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt)),
  );
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Holds the loading veil up while a page or the session is loading. */
export function AppLoading() {
  useLayoutEffect(() => {
    acquire();
    return release;
  }, []);
  return <div className="min-h-dvh bg-canvas" />;
}

/** Rendered once beside the router: the logo every AppLoading shows. */
export function LoadingVeil() {
  const veil = useSyncExternalStore(subscribe, () => state);
  const m = useMessages(common);
  if (veil === 'hidden') return null;
  const loading = veil === 'loading';
  return (
    <div
      // Only announced while something is still loading; the hold is visual only.
      role={loading ? 'status' : undefined}
      aria-label={loading ? m.loading : undefined}
      aria-hidden={loading ? undefined : true}
      className={cn(
        // Sized to 100vw, not the space beside the scrollbar: the page behind grows
        // a scrollbar as it renders, and the logo must not shift when it does.
        'fixed inset-y-0 left-0 z-[60] flex w-screen items-center justify-center bg-canvas transition-opacity ease-out motion-reduce:transition-none',
        veil === 'leaving' && 'pointer-events-none opacity-0',
      )}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      <LogoMark className="size-14 animate-pulse motion-reduce:animate-none" />
    </div>
  );
}
