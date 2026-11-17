import {
  ONBOARDING_ERROR_CODES,
  onboardingStepSchema,
  onboardingSubmissionSchema,
  type OnboardingProgress,
  type OnboardingStep,
} from '@montra/shared';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Loader2, LogOut, RotateCw } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Navigate } from 'react-router';
import { z } from 'zod';
import { authKeys, useCurrentUser, useLogout } from '../../api/auth';
import { ApiError, errorMessage } from '../../api/client';
import {
  onboardingKeys,
  onboardingProgressQuery,
  useCompleteOnboarding,
  useOnboardingProgress,
  useSaveOnboarding,
} from '../../api/onboarding';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/States';
import { showToast } from '../../stores/toasts';
import { firstName, hasBusinessAccess } from '../auth/access';
import { FormNotice } from '../auth/AuthFields';
import { AuthHeading, AuthLayout } from '../auth/AuthLayout';
import { useSignedInUser } from '../auth/currentUser';
import { useSchemaForm } from '../auth/useSchemaForm';
import {
  detailsFormSchema,
  formValuesFrom,
  hasUnsavedChanges,
  missingAnswersFrom,
  preferencesFormSchema,
  toDraft,
  type MissingAnswer,
} from './draft';
import { DetailsFields, PreferencesFields, ReviewSummary, SetupProgress } from './OnboardingSteps';

import { messagesFor, useMessages } from '../../i18n';
import { common } from '../../i18n/common';
import { onboardingMessages } from './messages';
const steps = onboardingStepSchema.options;

type Notice =
  | { kind: 'problem'; tone: 'negative' | 'warning'; title: string; body?: string }
  | { kind: 'incomplete'; title: string; answers: MissingAnswer[] };

const issueDetailsSchema = z.array(z.object({ path: z.string() }));

function issuePaths(details: unknown): string[] {
  const parsed = issueDetailsSchema.safeParse(details);
  return parsed.success ? parsed.data.map((issue) => issue.path) : [];
}

function failureBody(err: unknown): string {
  if (err instanceof ApiError && err.status === 0) {
    return messagesFor(onboardingMessages).page.offline;
  }
  return errorMessage(err);
}

/**
 * Business setup for signed-in users without a business. Progress is saved
 * to the API on every Continue, so setup resumes where the user left off on
 * any device. The API, not this page, creates the business.
 */
export function OnboardingPage() {
  const me = useSignedInUser();
  const hasAccess = hasBusinessAccess(me);
  const progress = useOnboardingProgress({ enabled: !hasAccess });
  const m = useMessages(onboardingMessages).page;

  // Owners who finished setup, and viewers (who never onboard), belong in the app.
  if (hasAccess) return <Navigate to="/" replace />;

  if (progress.data?.status === 'COMPLETED') return <SetupFinished />;
  if (progress.data) return <OnboardingWizard saved={progress.data} />;

  return (
    <AuthLayout>
      {progress.isError ? (
        <ErrorState title={m.loadError} onRetry={() => progress.refetch()} />
      ) : (
        <div role="status" aria-label={m.loading} className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted" strokeWidth={1.75} />
        </div>
      )}
    </AuthLayout>
  );
}

/** Setup completed, but the profile has no business yet: usually a moment before it updates. */
function SetupFinished() {
  const { refetch, isFetching } = useCurrentUser();
  const logout = useLogout();
  const m = useMessages(onboardingMessages).page;
  const c = useMessages(common);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return (
    <AuthLayout>
      <AuthHeading title={m.finishedTitle} description={m.finishedBody} />
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" size="lg" disabled={isFetching} onClick={() => refetch()}>
          {isFetching ? <Loader2 className="animate-spin" /> : <RotateCw />}
          {m.checkAgain}
        </Button>
        <Button
          variant="ghost"
          size="lg"
          disabled={logout.isPending}
          onClick={() => logout.mutate()}
        >
          <LogOut />
          {c.account.signOut}
        </Button>
      </div>
    </AuthLayout>
  );
}

function OnboardingWizard({ saved }: { saved: OnboardingProgress }) {
  const me = useSignedInUser();
  const queryClient = useQueryClient();
  const save = useSaveOnboarding();
  const complete = useCompleteOnboarding();
  const logout = useLogout();
  const t = useMessages(onboardingMessages);
  const m = t.page;
  const c = useMessages(common);

  const [initial] = useState(() => formValuesFrom(saved.draft));
  const details = useSchemaForm(detailsFormSchema, initial.details);
  const preferences = useSchemaForm(preferencesFormSchema, initial.preferences);
  const [step, setStep] = useState<OnboardingStep>(saved.currentStep);
  const [notice, setNotice] = useState<Notice | null>(null);

  // A ref, not state: a second click in the same frame must already see the first.
  const inFlight = useRef(false);
  const busy = save.isPending || complete.isPending || logout.isPending;
  const dirty = hasUnsavedChanges(details.values, preferences.values, saved.draft);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef(step);
  useEffect(() => {
    // Moving to another step puts screen readers at its title.
    if (shownStep.current !== step) headingRef.current?.focus();
    shownStep.current = step;
  }, [step]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  /** Runs one request at a time; extra clicks and key presses while it runs are ignored. */
  async function exclusive(task: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await task();
    } finally {
      inFlight.current = false;
    }
  }

  /** Replaces the form with the answers the API has, after they changed elsewhere. */
  async function adoptSavedAnswers() {
    const latest = await queryClient.fetchQuery({ ...onboardingProgressQuery, staleTime: 0 });
    const values = formValuesFrom(latest.draft);
    details.reset(values.details);
    preferences.reset(values.preferences);
  }

  async function handleFailure(err: unknown, action: 'save' | 'create') {
    if (!(err instanceof ApiError)) {
      setNotice({ kind: 'problem', tone: 'negative', title: failureBody(err) });
      return;
    }
    switch (err.code) {
      case ONBOARDING_ERROR_CODES.ALREADY_COMPLETED:
        // Finished in another tab: the refreshed profile opens the app.
        showToast({ tone: 'neutral', title: m.alreadySetUp });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: authKeys.me }),
          queryClient.invalidateQueries({ queryKey: onboardingKeys.progress }),
        ]);
        return;
      case ONBOARDING_ERROR_CODES.INCOMPLETE:
      case ONBOARDING_ERROR_CODES.CHANGED:
        try {
          await adoptSavedAnswers();
        } catch (reloadErr) {
          setNotice({
            kind: 'problem',
            tone: 'negative',
            title: m.reloadFailed,
            body: failureBody(reloadErr),
          });
          return;
        }
        setNotice(
          err.code === ONBOARDING_ERROR_CODES.INCOMPLETE
            ? {
                kind: 'incomplete',
                title: errorMessage(err),
                answers: missingAnswersFrom(issuePaths(err.details)),
              }
            : {
                kind: 'problem',
                tone: 'warning',
                title: errorMessage(err),
                body: m.latestSaved,
              },
        );
        return;
      default:
        setNotice({
          kind: 'problem',
          tone: 'negative',
          title: action === 'save' ? m.notSaved : m.notCreated,
          body: failureBody(err),
        });
    }
  }

  /** Saves every answer that is valid so far, with `currentStep` as where to resume. */
  async function saveAt(currentStep: OnboardingStep): Promise<boolean> {
    setNotice(null);
    try {
      await save.mutateAsync({
        currentStep,
        draft: toDraft(details.values, preferences.values),
      });
      return true;
    } catch (err) {
      await handleFailure(err, 'save');
      return false;
    }
  }

  function continueTo(next: OnboardingStep) {
    void exclusive(async () => {
      if (await saveAt(next)) setStep(next);
    });
  }

  function goBack() {
    // Kept in the form, not saved: Back never needs the current step to be valid.
    const index = steps.indexOf(step);
    setNotice(null);
    setStep(steps[Math.max(0, index - 1)]!);
  }

  const createBusiness = (event: FormEvent) => {
    event.preventDefault();
    void exclusive(async () => {
      setNotice(null);
      // The API creates the business from the saved draft, so that is what must be complete.
      const submission = onboardingSubmissionSchema.safeParse(saved.draft);
      if (!submission.success) {
        setNotice({
          kind: 'incomplete',
          title: m.incomplete,
          answers: missingAnswersFrom(submission.error.issues.map((issue) => issue.path.join('.'))),
        });
        return;
      }
      try {
        const { membership } = await complete.mutateAsync();
        showToast({
          tone: 'positive',
          title: m.ready,
          body: m.readyBody(membership.business.name),
        });
        // The profile now includes the membership, so OnboardingPage redirects to the dashboard.
      } catch (err) {
        await handleFailure(err, 'create');
      }
    });
  };

  const signOut = () =>
    exclusive(async () => {
      // Answers typed since the last Continue are saved first, so signing out loses nothing.
      if (dirty && !(await saveAt(step))) return;
      await logout.mutateAsync();
    });

  const stepIndex = steps.indexOf(step);
  const copy = t.steps[step];
  const savingLabel = save.isPending ? m.saving : m.continue;

  return (
    <AuthLayout>
      <header className="mb-7">
        <p className="eyebrow mb-3">{t.stepOf(stepIndex + 1, steps.length)}</p>
        <SetupProgress step={step} />
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-7 text-[26px] leading-[1.15] font-semibold tracking-[-0.025em] text-ink outline-none"
        >
          {copy.title}
        </h1>
        <p className="mt-2 text-[14px] text-muted">
          {step === 'BUSINESS_DETAILS' && saved.status === 'NOT_STARTED'
            ? t.welcome(firstName(me.user.name), copy.description)
            : copy.description}
        </p>
      </header>

      {notice && (
        <div className="mb-5">
          <SetupNotice notice={notice} onGoTo={setStep} />
        </div>
      )}

      {step === 'BUSINESS_DETAILS' && (
        <StepForm
          busy={busy}
          onSubmit={(event) =>
            details.handleSubmit(() => continueTo('FINANCIAL_PREFERENCES'))(event)
          }
          actions={<ContinueButton busy={busy} label={savingLabel} />}
        >
          <DetailsFields form={details} />
        </StepForm>
      )}

      {step === 'FINANCIAL_PREFERENCES' && (
        <StepForm
          busy={busy}
          onSubmit={(event) => preferences.handleSubmit(() => continueTo('REVIEW'))(event)}
          onBack={goBack}
          actions={<ContinueButton busy={busy} label={savingLabel} />}
        >
          <PreferencesFields form={preferences} currency={details.values.currency} />
        </StepForm>
      )}

      {step === 'REVIEW' && (
        <StepForm
          busy={busy}
          onSubmit={createBusiness}
          onBack={goBack}
          actions={
            <ContinueButton busy={busy} label={complete.isPending ? m.creating : m.create} />
          }
        >
          <ReviewSummary draft={saved.draft} onEdit={setStep} disabled={busy} />
        </StepForm>
      )}

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line pt-4 text-[12px]">
        <SaveStatus
          saving={save.isPending}
          dirty={dirty}
          everSaved={saved.status !== 'NOT_STARTED'}
        />
        <span className="flex items-center gap-2 text-faint">
          <span className="max-w-[180px] truncate">{me.user.email}</span>
          <Button variant="ghost" size="sm" disabled={busy} onClick={signOut}>
            <LogOut />
            {c.account.signOut}
          </Button>
        </span>
      </footer>
    </AuthLayout>
  );
}

function StepForm({
  busy,
  onSubmit,
  onBack,
  actions,
  children,
}: {
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onBack?: () => void;
  actions: ReactNode;
  children: ReactNode;
}) {
  const m = useMessages(onboardingMessages).page;
  return (
    <form noValidate onSubmit={onSubmit} aria-busy={busy} className="flex flex-col gap-5">
      {children}
      <div className="mt-1 flex items-center justify-between gap-3">
        {onBack ? (
          <Button variant="ghost" size="lg" disabled={busy} onClick={onBack}>
            <ArrowLeft />
            {m.back}
          </Button>
        ) : (
          <span />
        )}
        {actions}
      </div>
    </form>
  );
}

function ContinueButton({ busy, label }: { busy: boolean; label: string }) {
  return (
    <Button type="submit" variant="primary" size="lg" disabled={busy}>
      {busy && <Loader2 className="animate-spin" />}
      {label}
    </Button>
  );
}

function SetupNotice({
  notice,
  onGoTo,
}: {
  notice: Notice;
  onGoTo: (step: OnboardingStep) => void;
}) {
  if (notice.kind === 'problem') {
    return (
      <FormNotice tone={notice.tone}>
        <p className="font-medium">{notice.title}</p>
        {notice.body && <p className="mt-0.5">{notice.body}</p>}
      </FormNotice>
    );
  }
  return (
    <FormNotice tone="negative">
      <p className="font-medium">{notice.title}</p>
      {notice.answers.length > 0 && (
        <ul className="mt-1 flex flex-col gap-0.5">
          {notice.answers.map((answer) => (
            <li key={answer.label}>
              <button
                type="button"
                onClick={() => onGoTo(answer.step)}
                className="cursor-pointer underline underline-offset-2 hover:no-underline"
              >
                {answer.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </FormNotice>
  );
}

function SaveStatus({
  saving,
  dirty,
  everSaved,
}: {
  saving: boolean;
  dirty: boolean;
  everSaved: boolean;
}) {
  const m = useMessages(onboardingMessages).page;
  let content: ReactNode;
  if (saving) {
    content = (
      <>
        <Loader2 className="size-3.5 animate-spin" /> {m.savingProgress}
      </>
    );
  } else if (dirty) {
    content = (
      <>
        <span className="size-1.5 rounded-full bg-warning" /> {m.unsaved}
      </>
    );
  } else if (everSaved) {
    content = (
      <>
        <Check className="size-3.5 text-positive" strokeWidth={2.5} /> {m.saved}
      </>
    );
  } else {
    content = m.savedEachTime;
  }
  return (
    <p role="status" className="flex items-center gap-1.5 text-muted">
      {content}
    </p>
  );
}
