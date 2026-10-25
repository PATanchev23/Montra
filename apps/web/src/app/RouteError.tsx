import { AlertTriangle } from 'lucide-react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { Button } from '../components/ui/Button';

/** Last-resort screen when a page fails to load or throws while rendering. */
export function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unknown error';

  return (
    <div
      role="alert"
      className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-negative-soft text-negative">
        <AlertTriangle className="size-5" strokeWidth={1.75} />
      </span>
      <h1 className="mt-5 text-[22px] font-semibold tracking-[-0.02em] text-ink">
        Something went wrong
      </h1>
      <p className="mt-2 max-w-md text-[14px] text-muted">
        This page could not be displayed. Reloading usually fixes it.
      </p>
      <p className="mt-3 max-w-md font-mono text-[12px] text-faint">{message}</p>
      <div className="mt-6 flex gap-3">
        <Button variant="primary" onClick={() => window.location.reload()}>
          Reload
        </Button>
        <Button asChild>
          <Link to="/">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
