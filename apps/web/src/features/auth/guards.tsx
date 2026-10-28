import { useIsMutating } from '@tanstack/react-query';
import { CloudOff } from 'lucide-react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useCurrentUser } from '../../api/auth';
import { restoreSession, useSession } from '../../api/session';
import { AppLoading } from '../../app/AppLoading';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/States';
import { hasBusinessAccess, returnPathFrom } from './access';
import { CurrentUserContext, useSignedInUser } from './currentUser';

/** Shown when the session could not be checked at all (API down, rate limited). */
function SessionUnavailable({ problem }: { problem: string | null }) {
  return (
    <div
      role="alert"
      className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning">
        <CloudOff className="size-5" strokeWidth={1.75} />
      </span>
      <h1 className="mt-5 text-[22px] font-semibold tracking-[-0.02em] text-ink">
        Montra can’t check your session
      </h1>
      <p className="mt-2 max-w-md text-[14px] text-muted">
        {problem ?? 'Could not reach the Montra API.'} Your data is safe; try again in a moment.
      </p>
      <Button variant="primary" className="mt-6" onClick={restoreSession}>
        Try again
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

  if (session.status === 'loading') return <AppLoading />;
  if (session.status === 'unavailable') return <SessionUnavailable problem={session.problem} />;
  if (session.status === 'anonymous') {
    // After an explicit sign-out the next sign-in starts fresh on the dashboard.
    const state = session.signOutReason === 'signed-out' ? undefined : { from: location };
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
        <ErrorState title="Could not load your account" onRetry={() => me.refetch()} />
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
