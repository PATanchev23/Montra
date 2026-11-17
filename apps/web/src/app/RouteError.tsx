import { AlertTriangle } from 'lucide-react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { Button } from '../components/ui/Button';
import { useMessages } from '../i18n';
import { common } from '../i18n/common';

/** Last-resort screen when a page fails to load or throws while rendering. */
export function RouteError() {
  const error = useRouteError();
  const c = useMessages(common);
  const m = c.routeError;
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : m.unknown;

  return (
    <div
      role="alert"
      className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-negative-soft text-negative">
        <AlertTriangle className="size-5" strokeWidth={1.75} />
      </span>
      <h1 className="mt-5 text-[22px] font-semibold tracking-[-0.02em] text-ink">{m.title}</h1>
      <p className="mt-2 max-w-md text-[14px] text-muted">{m.body}</p>
      <p className="mt-3 max-w-md font-mono text-[12px] text-faint">{message}</p>
      <div className="mt-6 flex gap-3">
        <Button variant="primary" onClick={() => window.location.reload()}>
          {m.reload}
        </Button>
        <Button asChild>
          <Link to="/">{c.notFound.back}</Link>
        </Button>
      </div>
    </div>
  );
}
