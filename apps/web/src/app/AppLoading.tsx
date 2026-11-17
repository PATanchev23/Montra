import { LogoMark } from '../components/Logo';
import { useMessages } from '../i18n';
import { common } from '../i18n/common';

/** Shown only while a deep-linked, lazily loaded page downloads on first visit. */
export function AppLoading() {
  const m = useMessages(common);
  return (
    <div
      className="flex min-h-dvh items-center justify-center bg-canvas"
      role="status"
      aria-label={m.loading}
    >
      <LogoMark className="size-10 animate-pulse" />
    </div>
  );
}
