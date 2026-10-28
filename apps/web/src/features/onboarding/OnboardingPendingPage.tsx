import { onboardingStepSchema, type OnboardingStatus, type OnboardingStep } from '@montra/shared';
import { Check, Loader2, LogOut, RotateCw } from 'lucide-react';
import { Navigate } from 'react-router';
import { useCurrentUser, useLogout } from '../../api/auth';
import { Badge, type Tone } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/cn';
import { firstName, hasBusinessAccess } from '../auth/access';
import { AuthLayout } from '../auth/AuthLayout';
import { useSignedInUser } from '../auth/currentUser';

const stepCopy: Record<OnboardingStep, { title: string; body: string }> = {
  BUSINESS_DETAILS: {
    title: 'Business details',
    body: 'Store name, industry, currency and time zone.',
  },
  FINANCIAL_PREFERENCES: {
    title: 'Financial preferences',
    body: 'Fiscal year start and a low-balance safety buffer.',
  },
  REVIEW: { title: 'Review', body: 'Confirm, and Montra creates your business.' },
};

const statusBadge: Record<OnboardingStatus, { label: string; tone: Tone }> = {
  NOT_STARTED: { label: 'Not started', tone: 'neutral' },
  IN_PROGRESS: { label: 'In progress', tone: 'accent' },
  COMPLETED: { label: 'Completed', tone: 'positive' },
};

/**
 * Temporary stop for signed-in users without a business, until the guided
 * onboarding flow ships. Shows real progress from /auth/me.
 */
export function OnboardingPendingPage() {
  const me = useSignedInUser();
  const { refetch, isFetching } = useCurrentUser();
  const logout = useLogout();

  if (hasBusinessAccess(me)) return <Navigate to="/" replace />;

  const { status, currentStep } = me.onboarding;
  const currentIndex = onboardingStepSchema.options.indexOf(currentStep);

  return (
    <AuthLayout>
      <header className="mb-7">
        <div className="mb-3 flex items-center gap-2">
          <p className="eyebrow">Business setup</p>
          <Badge tone={statusBadge[status].tone} dot>
            {statusBadge[status].label}
          </Badge>
        </div>
        <h1 className="text-[26px] leading-[1.15] font-semibold tracking-[-0.025em] text-ink">
          Let’s set up your business, {firstName(me.user.name)}
        </h1>
        <p className="mt-2 text-[14px] text-muted">
          Your account is ready. Before Montra can track your cash flow it needs a few details about
          your store. Guided setup is coming in the next release; you’ll pick up right here.
        </p>
      </header>

      <ol className="flex flex-col rounded-panel border border-line bg-surface">
        {onboardingStepSchema.options.map((step, index) => {
          const done = status !== 'NOT_STARTED' && index < currentIndex;
          const current = index === currentIndex;
          return (
            <li
              key={step}
              aria-current={current ? 'step' : undefined}
              className="flex items-start gap-3.5 border-b border-line px-4 py-3.5 last:border-b-0"
            >
              <span
                className={cn(
                  'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-[12px] font-medium',
                  done && 'border-transparent bg-positive-soft text-positive',
                  current && 'border-accent-line bg-accent-soft text-accent',
                  !done && !current && 'border-line text-muted',
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={2.5} /> : index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-medium text-ink">
                  {stepCopy[step].title}
                </span>
                <span className="block text-[13px] text-muted">{stepCopy[step].body}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <Button variant="primary" size="lg" disabled={isFetching} onClick={() => refetch()}>
          {isFetching ? <Loader2 className="animate-spin" /> : <RotateCw />}
          Check again
        </Button>
        <Button
          variant="ghost"
          size="lg"
          disabled={logout.isPending}
          onClick={() => logout.mutate()}
        >
          <LogOut />
          Sign out
        </Button>
      </div>
      <p className="mt-4 text-[12px] text-faint">Signed in as {me.user.email}.</p>
    </AuthLayout>
  );
}
