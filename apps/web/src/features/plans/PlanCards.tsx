import { Check, Info } from 'lucide-react';
import { useId } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useMessages } from '../../i18n';
import { cn } from '../../lib/cn';
import { money } from '../../lib/format';
import { plansMessages } from './messages';
import { CURRENT_PLAN, PLAN_CURRENCY, PLANS, type Plan } from './plans';

/** Says plainly that nothing is charged yet and every feature is open meanwhile. */
export function EarlyAccessNote({ className }: { className?: string }) {
  const m = useMessages(plansMessages);
  return (
    <p
      className={cn(
        'flex items-start gap-2.5 rounded-field border border-line px-4 py-3 text-body-sm text-ink-2',
        className,
      )}
    >
      <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" strokeWidth={1.75} />
      {m.earlyAccess}
    </p>
  );
}

function PlanCard({ plan, headingLevel }: { plan: Plan; headingLevel: 'h2' | 'h3' }) {
  const m = useMessages(plansMessages);
  const Heading = headingLevel;
  const name = m.names[plan.id];
  const current = plan.id === CURRENT_PLAN;
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
          {name}
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

      {current ? (
        <p className="mt-5 flex h-11 items-center justify-center gap-2 rounded-control bg-hover text-body font-medium text-ink-2">
          <Check aria-hidden className="size-4" strokeWidth={2.25} />
          {m.current}
        </p>
      ) : (
        // Not on sale yet: a quiet disabled button (a dimmed ink one reads as broken).
        <Button size="lg" disabled className="mt-5 w-full">
          {m.comingSoon}
        </Button>
      )}

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
  return (
    <ul aria-label={m.title} className={cn('grid gap-4 sm:gap-6 md:grid-cols-3', className)}>
      {PLANS.map((plan) => (
        <li key={plan.id} className="min-w-0">
          <PlanCard plan={plan} headingLevel={headingLevel} />
        </li>
      ))}
    </ul>
  );
}
