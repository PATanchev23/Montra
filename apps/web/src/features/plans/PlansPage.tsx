import { Check, Minus } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel, PanelHeader } from '../../components/ui/Panel';
import { useMessages } from '../../i18n';
import { cn } from '../../lib/cn';
import { plansMessages } from './messages';
import { EarlyAccessNote, PlanCards } from './PlanCards';
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

/**
 * Free, Pro and Business side by side, then every feature in one table.
 * Display only: billing does not exist yet, so the paid plans are marked as
 * coming soon and every feature stays open meanwhile.
 */
export function PlansPage() {
  const m = useMessages(plansMessages);
  return (
    <div className="flex flex-col gap-6 lg:gap-7">
      <PageHeader title={m.title} description={m.description} />
      <EarlyAccessNote />
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
