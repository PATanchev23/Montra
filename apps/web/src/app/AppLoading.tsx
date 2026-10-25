import { LogoMark } from '../components/Logo';

/** Shown only while a deep-linked, lazily loaded page downloads on first visit. */
export function AppLoading() {
  return (
    <div
      className="flex min-h-dvh items-center justify-center bg-canvas"
      role="status"
      aria-label="Loading Montra"
    >
      <LogoMark className="size-10 animate-pulse" />
    </div>
  );
}
