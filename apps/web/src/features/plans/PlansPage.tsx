import { Check, Minus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useBilling } from '../../api/billing';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel, PanelHeader } from '../../components/ui/Panel';
import { useMessages } from '../../i18n';
import { cn } from '../../lib/cn';
import { plansMessages } from './messages';
import { BillingNote, PlanCards } from './PlanCards';
import { COMPARISON, PLANS, type Availability } from './plans';

function Cell({ value }: { value: Availability }) {
  const m = useMessages(plansMessages).compare;
  if (value === true)
    return (
      <>
        <Check aria-hidden className="mx-auto size-4 text-ink" strokeWidth={2.25} />
        <span className="sr-only">{m.included}</span>
      </>
    );
  if (value === false)
    return (
      <>
        <Minus aria-hidden className="mx-auto size-4 text-muted" strokeWidth={1.75} />
        <span className="sr-only">{m.notIncluded}</span>
      </>
    );
  return <span className="tabular text-ink">{m[value] as string}</span>;
}

/** How long to wait for Stripe's confirmation before saying it is slow. */
const CONFIRM_WAIT_MS = 30_000;

/**
 * Back from Stripe Checkout (`?checkout=success` or `cancelled`). Success is
 * only claimed once the API has heard from Stripe; until then it says it is
 * confirming, and after a while that it is taking longer.
 */
function CheckoutReturn() {
  const m = useMessages(plansMessages);
  const [params, setParams] = useSearchParams();
  const outcome = params.get('checkout');
  const [slow, setSlow] = useState(false);
  const { data: billing } = useBilling({ pollWhileFree: outcome === 'success' && !slow });

  useEffect(() => {
    if (outcome !== 'success') return;
    const timer = setTimeout(() => setSlow(true), CONFIRM_WAIT_MS);
    return () => clearTimeout(timer);
  }, [outcome]);

  if (outcome !== 'success' && outcome !== 'cancelled') return null;

  const done = outcome === 'success' && billing !== undefined && billing.plan !== 'free';
  const [text, tone] =
    outcome === 'cancelled'
      ? [m.checkout.cancelled, 'border-line text-ink-2']
      : done
        ? [
            m.checkout.done(m.names[billing.plan]),
            'border-transparent bg-positive-soft text-positive',
          ]
        : slow
          ? [m.checkout.slow, 'border-transparent bg-warning-soft text-warning']
          : [m.checkout.confirming, 'border-line text-ink-2'];

  return (
    <div
      role="status"
      className={cn('flex items-start gap-3 rounded-field border px-4 py-3 text-body-sm', tone)}
    >
      <p className="min-w-0 flex-1 font-medium">{text}</p>
      <button
        type="button"
        aria-label={m.dialog.close}
        onClick={() =>
          setParams(
            (current) => {
              current.delete('checkout');
              return current;
            },
            { replace: true },
          )
        }
        className="-m-1 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md opacity-70 transition-opacity hover:opacity-100"
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}

/**
 * Free, Pro and Business side by side, then every feature in one table.
 * Paying, switching and cancelling happen on Stripe's own pages; every
 * feature stays open on every plan for now.
 */
export function PlansPage() {
  const m = useMessages(plansMessages);
  return (
    <div className="flex flex-col gap-6 lg:gap-7">
      <PageHeader title={m.title} description={m.description} />
      <CheckoutReturn />
      <BillingNote />
      <PlanCards />

      <Panel className="p-5 sm:p-6" aria-labelledby="compare-title">
        <PanelHeader
          id="compare-title"
          title={m.compare.title}
          description={m.compare.description}
        />
        {/*
          Scrolls sideways on the narrowest phones rather than crushing the plan columns.
          Relative, so the screen-reader labels (absolutely placed) scroll with it
          instead of widening the page.
        */}
        <div className="relative mt-4 overflow-x-auto">
          <table className="w-full min-w-[30rem] text-body-sm">
            <caption className="sr-only">{m.compare.title}</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="py-3 pr-4 text-left font-medium text-muted">
                  {m.compare.feature}
                </th>
                {PLANS.map((plan) => (
                  <th
                    key={plan.id}
                    scope="col"
                    className={cn(
                      'w-[22%] px-2 py-3 text-center font-semibold text-ink',
                      plan.recommended && 'bg-hover/60',
                    )}
                  >
                    {m.names[plan.id]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {COMPARISON.map(({ row, plans }) => (
                <tr key={row}>
                  <th scope="row" className="py-3 pr-4 text-left font-normal text-ink-2">
                    {m.compare.rows[row]}
                  </th>
                  {PLANS.map((plan) => (
                    <td
                      key={plan.id}
                      className={cn('px-2 py-3 text-center', plan.recommended && 'bg-hover/60')}
                    >
                      <Cell value={plans[plan.id]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
