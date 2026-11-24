import { createBusinessRequestSchema } from '@montra/shared';
import { ArrowLeft, Building2, Loader2 } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { errorMessage } from '../../api/client';
import { useCreateBusiness } from '../../api/business';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel, PanelHeader } from '../../components/ui/Panel';
import { EmptyState, Skeleton } from '../../components/ui/States';
import { useMessages } from '../../i18n';
import { showToast } from '../../stores/toasts';
import { useUiStore } from '../../stores/ui';
import { useBusinessAllowance } from '../auth/currentUser';
import { useSchemaForm } from '../auth/useSchemaForm';
import { FormNotice } from '../auth/AuthFields';
import {
  detailsFormSchema,
  formValuesFrom,
  preferencesFormSchema,
  toDraft,
} from '../onboarding/draft';
import { DetailsFields, PreferencesFields } from '../onboarding/OnboardingSteps';
import { businessMessages } from './messages';

/**
 * Another business for an account that already owns one, within its plan's
 * limit (the API enforces the same rule). The same questions onboarding asks,
 * on one page; the new business opens as soon as it exists.
 */
export function NewBusinessPage() {
  const allowance = useBusinessAllowance();
  const m = useMessages(businessMessages).create;

  if (!allowance.isOwner) {
    return (
      <Blocked title={m.viewerTitle} body={m.viewerBody} action={<BackLink label={m.back} />} />
    );
  }
  if (allowance.limit === undefined) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full rounded-panel" />
      </div>
    );
  }
  if (!allowance.canAdd) {
    return (
      <Blocked
        title={m.limitTitle}
        body={m.limitBody(allowance.limit)}
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <BackLink label={m.back} />
            <Button asChild variant="primary">
              <Link to="/plans">{m.seePlans}</Link>
            </Button>
          </div>
        }
      />
    );
  }
  return <NewBusinessForm owned={allowance.owned} limit={allowance.limit} />;
}

function NewBusinessForm({ owned, limit }: { owned: number; limit: number }) {
  const m = useMessages(businessMessages).create;
  const navigate = useNavigate();
  const setBusinessId = useUiStore((s) => s.setBusinessId);
  const create = useCreateBusiness();
  const [initial] = useState(() => formValuesFrom({}));
  const details = useSchemaForm(detailsFormSchema, initial.details);
  const preferences = useSchemaForm(preferencesFormSchema, initial.preferences);
  const [failure, setFailure] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Both halves show their errors, and the first invalid field takes focus.
    details.handleSubmit(() => {})(event);
    preferences.handleSubmit(() => {})(event);
    if (
      !detailsFormSchema.safeParse(details.values).success ||
      !preferencesFormSchema.safeParse(preferences.values).success
    ) {
      return;
    }
    const request = createBusinessRequestSchema.safeParse(
      toDraft(details.values, preferences.values),
    );
    if (!request.success) return;
    setFailure(null);
    create.mutate(request.data, {
      onSuccess: ({ membership }) => {
        setBusinessId(membership.business.id);
        showToast({
          tone: 'positive',
          title: m.created(membership.business.name),
          body: m.createdBody,
        });
        // The new dashboard opens at its top, not where the Create button was.
        window.scrollTo({ top: 0 });
        navigate('/');
      },
      onError: (err) => setFailure(errorMessage(err, m.failed)),
    });
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-6">
      <PageHeader
        title={m.title}
        description={
          <>
            <span className="block">{m.description}</span>
            <span className="tabular mt-1 block text-body-sm">{m.allowance(owned, limit)}</span>
          </>
        }
      />

      <Panel className="p-5 sm:p-6" aria-labelledby="new-business-details">
        <PanelHeader id="new-business-details" title={m.details} description={m.detailsHint} />
        <div className="mt-4">
          <DetailsFields form={details} />
        </div>
      </Panel>

      <Panel className="p-5 sm:p-6" aria-labelledby="new-business-money">
        <PanelHeader
          id="new-business-money"
          title={m.preferences}
          description={m.preferencesHint}
        />
        <div className="mt-4">
          <PreferencesFields form={preferences} currency={details.values.currency} />
        </div>
      </Panel>

      {failure && <FormNotice tone="negative">{failure}</FormNotice>}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button asChild variant="ghost">
          <Link to="/">{m.cancel}</Link>
        </Button>
        <Button type="submit" variant="primary" size="lg" disabled={create.isPending}>
          {create.isPending && <Loader2 className="animate-spin" />}
          {create.isPending ? m.submitting : m.submit}
        </Button>
      </div>
    </form>
  );
}

function Blocked({ title, body, action }: { title: string; body: string; action: ReactNode }) {
  return (
    <Panel>
      <EmptyState icon={Building2} title={title} body={body} action={action} />
    </Panel>
  );
}

function BackLink({ label }: { label: string }) {
  return (
    <Button asChild>
      <Link to="/">
        <ArrowLeft />
        {label}
      </Link>
    </Button>
  );
}
