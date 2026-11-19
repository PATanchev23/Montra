import { useIsMutating } from '@tanstack/react-query';
import { CloudOff } from 'lucide-react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useCurrentUser } from '../../api/auth';
import { restoreSession, useSession } from '../../api/session';
import { AppLoading } from '../../app/AppLoading';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/States';
import { useMessages } from '../../i18n';
import { common } from '../../i18n/common';
import { localizeMessage } from '../../i18n/serverMessages';
import { hasBusinessAccess, returnPathFrom } from './access';
import { CurrentUserContext, useSignedInUser } from './currentUser';
import { authMessages } from './messages';

/** Shown when the session could not be checked at all (API down, rate limited). */
function SessionUnavailable({ problem }: { problem: string | null }) {
  const m = useMessages(authMessages).guards;
  const c = useMessages(common);
  return (
    <div
      role="alert"
      className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning">
        <CloudOff className="size-5" strokeWidth={1.75} />
      </span>
      <h1 className="mt-5 text-[22px] font-semibold tracking-[-0.02em] text-ink">
        {m.sessionTitle}
      </h1>
      <p className="mt-2 max-w-md text-[14px] text-muted">
        {problem ? localizeMessage(problem) : m.apiUnreachable} {m.dataSafe}
      </p>
      <Button variant="primary" className="mt-6" onClick={restoreSession}>
        {c.tryAgain}
      </Button>
    </div>
  );
}

/**
 * Renders its routes only for a signed-in user whose profile (/auth/me) has
 * loaded, and provides that profile. Everyone else goes to /login, which
 * brings them back here afterwards.
 */
export function RequireAuth() {
  const session = useSession();
  const location = useLocation();
  const me = useCurrentUser();
  const accountError = useMessages(authMessages).guards.accountError;

  if (session.status === 'loading') return <AppLoading />;
  if (session.status === 'unavailable') return <SessionUnavailable problem={session.problem} />;
  if (session.status === 'anonymous') {
    // After an explicit sign-out (or deleting the account) the next sign-in
    // starts fresh on the dashboard.
    const startFresh =
      session.signOutReason === 'signed-out' || session.signOutReason === 'deleted';
    const state = startFresh ? undefined : { from: location };
    return <Navigate to="/login" replace state={state} />;
  }

  if (me.data) {
    return (
      <CurrentUserContext value={me.data}>
        <Outlet />
      </CurrentUserContext>
    );
  }
  if (me.isError) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas">
        <ErrorState title={accountError} onRetry={() => me.refetch()} />
      </div>
    );
  }
  return <AppLoading />;
}

/** The financial app needs a business; users without one wait at /onboarding. */
export function RequireBusiness() {
  const me = useSignedInUser();
  return hasBusinessAccess(me) ? <Outlet /> : <Navigate to="/onboarding" replace />;
}

/** Sign-in and registration: signed-in users are sent on to where they were going. */
export function GuestOnly() {
  const session = useSession();
  const me = useCurrentUser();
  const location = useLocation();
  // A sign-in submitted from this page keeps the form on screen (busy) until it finishes.
  const signingIn = useIsMutating() > 0;

  if (session.status === 'loading') return <AppLoading />;
  if (session.status === 'authenticated') {
    if (me.data) return <Navigate to={returnPathFrom(location.state)} replace />;
    if (me.isPending && !signingIn) return <AppLoading />;
  }
  return <Outlet />;
}
