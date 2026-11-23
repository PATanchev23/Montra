import type { BillingResponse } from '@montra/shared';
import { Check, Info, Settings2 } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { errorMessage } from '../../api/client';
import { useBilling, useOpenBillingPortal, useStartCheckout } from '../../api/billing';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/States';
import { useMessages } from '../../i18n';
import { cn } from '../../lib/cn';
import { money } from '../../lib/format';
import { plansMessages } from './messages';
import { PLAN_CURRENCY, PLANS, type Plan } from './plans';
import { subscriptionLine } from './subscription';

/**
 * What the plans mean right now: before Stripe is set up, that nothing is
 * charged; after, that every feature is still open (and, in test mode, that
 * no real money moves). Subscribers get Manage billing here.
 */
export function BillingNote({ className }: { className?: string }) {
  const m = useMessages(plansMessages);
  const { data: billing } = useBilling();
  const portal = useOpenBillingPortal();
  if (!billing) return null;

  const text = !billing.configured
    ? m.earlyAccess
    : [m.openForNow, billing.testMode && m.testMode, !billing.canSubscribe && m.ownersOnly]
        .filter(Boolean)
        .join(' ');

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-3 rounded-field border border-line px-4 py-3',
        className,
      )}
    >
      <p className="flex min-w-0 flex-1 basis-80 items-start gap-2.5 text-body-sm text-ink-2">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" strokeWidth={1.75} />
        {text}
      </p>
      {billing.canManage && (
        <Button size="sm" disabled={portal.isPending} onClick={() => portal.mutate()}>
          <Settings2 />
          {portal.isPending ? m.opening : m.manage}
        </Button>
      )}
      {portal.isError && (
        <p role="alert" className="w-full text-body-sm text-negative">
          {errorMessage(portal.error)}
        </p>
      )}
    </div>
  );
}

function PlanAction({
  plan,
  billing,
  checkout,
  portal,
}: {
  plan: Plan;
  billing: BillingResponse | undefined;
  checkout: ReturnType<typeof useStartCheckout>;
  portal: ReturnType<typeof useOpenBillingPortal>;
}) {
  const m = useMessages(plansMessages);
  if (!billing) return <Skeleton className="mt-5 h-11 w-full rounded-control" />;

  if (plan.id === billing.plan) {
    const line = subscriptionLine(billing, m);
    return (
      <>
        <p className="mt-5 flex h-11 items-center justify-center gap-2 rounded-control bg-hover text-body font-medium text-ink-2">
          <Check aria-hidden className="size-4" strokeWidth={2.25} />
          {m.current}
        </p>
        {line && (
          <p
            className={cn(
              'tabular mt-2 text-center text-caption',
              line.warning ? 'text-warning' : 'text-muted',
            )}
          >
            {line.text}
          </p>
        )}
      </>
    );
  }

  // Before Stripe is set up, the paid plans are honestly not on sale.
  if (!billing.configured) {
    return (
      <Button size="lg" disabled className="mt-5 w-full">
        {m.comingSoon}
      </Button>
    );
  }

  // A subscriber changes plan (or goes back to Free) in Stripe's portal.
  if (billing.plan !== 'free') {
    return (
      <Button
        size="lg"
        className="mt-5 w-full"
        disabled={!billing.canManage || portal.isPending}
        onClick={() => portal.mutate()}
      >
        {portal.isPending ? m.opening : m.changePlan}
      </Button>
    );
  }

  const paid = plan.id === 'free' ? null : plan.id;
  if (!paid) return null;
  const opening = checkout.isPending && checkout.variables === paid;
  return (
    <Button
      size="lg"
      // One ink action in the group: the recommended plan's.
      variant={plan.recommended ? 'primary' : 'secondary'}
      className="mt-5 w-full"
      disabled={!billing.canSubscribe || checkout.isPending}
      onClick={() => checkout.mutate(paid)}
    >
      {opening ? m.opening : m.upgradeTo(m.names[paid])}
    </Button>
  );
}

function PlanCard({
  plan,
  headingLevel,
  action,
}: {
  plan: Plan;
  headingLevel: 'h2' | 'h3';
  action: ReactNode;
}) {
  const m = useMessages(plansMessages);
  const Heading = headingLevel;
  // Unique even with the dialog open over the Plans page.
  const titleId = `${useId()}-title`;

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        'flex h-full flex-col rounded-panel border bg-surface p-5 shadow-panel sm:p-6',
        // The recommended plan is held by an ink edge, not a fill: one ink action per group.
        plan.recommended ? 'border-accent' : 'border-panel-line',
      )}
    >
      <div className="flex min-h-[22px] items-center justify-between gap-3">
        <Heading id={titleId} className="text-title text-ink">
          {m.names[plan.id]}
        </Heading>
        {plan.recommended && <Badge>{m.recommended}</Badge>}
      </div>
      <p className="mt-1 text-body-sm text-muted">{m.taglines[plan.id]}</p>

      <p className="mt-5 flex flex-wrap items-baseline gap-x-1.5">
        <span className="tabular text-figure text-ink">
          {money(plan.priceCents, { decimals: 0, currency: PLAN_CURRENCY })}
        </span>
        <span className="text-body-sm text-muted">{m.perMonth}</span>
      </p>

      {action}

      <div className="mt-6 border-t border-line pt-5">
        {plan.builds && (
          <p className="mb-3 text-body-sm font-medium text-ink">
            {m.everythingIn(m.names[plan.builds])}
          </p>
        )}
        <ul className="flex flex-col gap-2.5">
          {m.highlights[plan.id].map((feature) => (
            <li key={feature} className="flex gap-2.5 text-body-sm text-ink-2">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-ink" strokeWidth={2} />
              {feature}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

/** The three plans side by side (stacked on phones), shared by the Plans page and dialog. */
export function PlanCards({
  headingLevel = 'h2',
  className,
}: {
  /** `h3` inside the dialog, whose title is the `h2`. */
  headingLevel?: 'h2' | 'h3';
  className?: string;
}) {
  const m = useMessages(plansMessages);
  const { data: billing } = useBilling();
  const checkout = useStartCheckout();
  const portal = useOpenBillingPortal();
  const failed = checkout.error ?? portal.error;

  return (
    <div className={className}>
      <ul aria-label={m.title} className="grid gap-4 sm:gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <li key={plan.id} className="min-w-0">
            <PlanCard
              plan={plan}
              headingLevel={headingLevel}
              action={
                <PlanAction plan={plan} billing={billing} checkout={checkout} portal={portal} />
              }
            />
          </li>
        ))}
      </ul>
      {failed && (
        <p role="alert" className="mt-4 text-center text-body-sm text-negative">
          {errorMessage(failed)}
        </p>
      )}
    </div>
  );
}
