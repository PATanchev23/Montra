import type { BillingResponse } from '@montra/shared';
import { Check } from 'lucide-react';
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

/*
 * The plans, set like a product's pricing rather than an admin form: the price
 * is the largest thing on each card, actions are capsules (the shape the
 * charts and segmented controls already use), and the conditions sit beneath
 * as fine print instead of a boxed notice.
 */

/** Capsule actions, Montra's signature shape. */
const PILL = 'h-11 w-full rounded-full';

/**
 * For anyone with billing: the plan they are on and the way to Stripe's
 * billing portal. Nothing for an account that has never subscribed.
 */
export function PlanStatus({ className }: { className?: string }) {
  const m = useMessages(plansMessages);
  const { data: billing } = useBilling();
  const portal = useOpenBillingPortal();
  if (!billing || (billing.plan === 'free' && !billing.canManage)) return null;

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div className="inline-flex max-w-full items-center gap-3 rounded-full border border-panel-line bg-surface py-1.5 pr-1.5 pl-4 shadow-panel">
        <span className="min-w-0 truncate text-body-sm font-medium text-ink">
          {m.youreOn(m.names[billing.plan])}
        </span>
        {billing.canManage && (
          <Button
            size="sm"
            className="rounded-full"
            disabled={portal.isPending}
            onClick={() => portal.mutate()}
          >
            {portal.isPending ? m.opening : m.manage}
          </Button>
        )}
      </div>
      {portal.isError && (
        <p role="alert" className="text-body-sm text-negative">
          {errorMessage(portal.error)}
        </p>
      )}
    </div>
  );
}

/** The conditions, quietly: nothing locked yet, test cards in test mode, owners only. */
export function PlansFinePrint({ className }: { className?: string }) {
  const m = useMessages(plansMessages);
  const { data: billing } = useBilling();
  if (!billing) return null;
  const text = !billing.configured
    ? m.earlyAccess
    : [m.openForNow, billing.testMode && m.testMode, !billing.canSubscribe && m.ownersOnly]
        .filter(Boolean)
        .join(' ');
  return (
    <p
      className={cn(
        'mx-auto max-w-2xl text-center text-caption text-balance text-muted',
        className,
      )}
    >
      {text}
    </p>
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
  if (!billing) return <Skeleton className={cn(PILL, 'rounded-full')} />;

  if (plan.id === billing.plan) {
    const line = subscriptionLine(billing, m);
    return (
      <div>
        <p
          className={cn(
            PILL,
            'flex items-center justify-center gap-2 bg-hover text-body font-medium text-ink-2',
          )}
        >
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
      </div>
    );
  }

  // Before Stripe is set up, the paid plans are honestly not on sale.
  if (!billing.configured) {
    return (
      <Button size="lg" disabled className={PILL}>
        {m.comingSoon}
      </Button>
    );
  }

  // A subscriber changes plan (or goes back to Free) in Stripe's portal.
  if (billing.plan !== 'free') {
    return (
      <Button
        size="lg"
        className={PILL}
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
      className={PILL}
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
        // Side by side, the cards share rows, so names, prices and actions line up
        // across all three however their taglines wrap.
        'flex h-full flex-col rounded-panel border bg-surface px-6 pt-6 pb-7 shadow-panel sm:px-7',
        'md:row-span-5 md:grid md:grid-rows-subgrid md:gap-0',
        // The recommended plan is held by a firmer ink edge, not a fill.
        plan.recommended ? 'border-accent ring-1 ring-accent' : 'border-panel-line',
      )}
    >
      <div className="flex min-h-[22px] items-center justify-between gap-3">
        <Heading id={titleId} className="text-title text-ink">
          {m.names[plan.id]}
        </Heading>
        {plan.recommended && <Badge>{m.recommended}</Badge>}
      </div>
      <p className="mt-1.5 text-body-sm text-muted">{m.taglines[plan.id]}</p>

      <p className="mt-7 mb-6 flex flex-wrap items-baseline gap-x-2">
        <span className="tabular text-[2.75rem] leading-none font-semibold tracking-[-0.04em] text-ink">
          {money(plan.priceCents, { decimals: 0, currency: PLAN_CURRENCY })}
        </span>
        <span className="text-body-sm text-muted">{m.perMonth}</span>
      </p>

      {action}

      <div className="mt-7">
        <p className="mb-3.5 text-body-sm font-medium text-ink">
          {plan.builds ? m.everythingIn(m.names[plan.builds]) : m.includes}
        </p>
        <ul className="flex flex-col gap-3">
          {m.highlights[plan.id].map((feature) => (
            <li key={feature} className="flex gap-3 text-body-sm text-ink-2">
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
      <ul
        aria-label={m.title}
        className="grid gap-4 sm:gap-5 md:grid-cols-3 md:grid-rows-[repeat(5,auto)]"
      >
        {PLANS.map((plan) => (
          <li key={plan.id} className="min-w-0 md:row-span-5 md:grid md:grid-rows-subgrid">
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
