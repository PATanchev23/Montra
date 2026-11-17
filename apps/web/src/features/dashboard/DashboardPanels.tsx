import type { DashboardResponse } from '@montra/shared';
import { format, parseISO } from 'date-fns';
import { ArrowRight, FlaskConical, Play } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  DEMO_TODAY,
  FORECAST_DAYS,
  useScenarioResult,
  useScenarios,
  useUpcomingPayments,
} from '../../api/finance';
import { DonutChart } from '../../components/charts/DonutChart';
import { Sparkline } from '../../components/charts/Sparkline';
import { Amount } from '../../components/finance/Amount';
import { rankFills, rankSwatches } from '../../components/finance/categoryVisuals';
import { LedgerRow, LedgerSkeleton } from '../../components/finance/LedgerRow';
import { Button } from '../../components/ui/Button';
import { Panel, PanelHeader } from '../../components/ui/Panel';
import { ErrorState, Skeleton } from '../../components/ui/States';
import { Tooltip } from '../../components/ui/Tooltip';
import { cn } from '../../lib/cn';
import { formatDate, money, relativeDay } from '../../lib/format';
import { entryType } from '../transactions/display';
import { TypeIcon } from '../transactions/TypeIcon';
import { shareLabel } from './period';

function ViewAll({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      aria-label={label}
      className="group inline-flex items-center gap-1.5 rounded-md text-body-sm font-medium whitespace-nowrap text-ink hover:underline"
    >
      View all
      <ArrowRight
        aria-hidden
        className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
        strokeWidth={2}
      />
    </Link>
  );
}

function PanelNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 rounded-control bg-sunken px-4 py-6 text-center text-body-sm text-muted">
      {children}
    </p>
  );
}

const SAMPLE_NOTE =
  'Deterministic TechStore sample data, not this business’s own figures. Live data arrives with the financial API.';

/** The day the sample layer treats as today; its dates are measured from it, not from the real date. */
const SAMPLE_AS_OF = format(DEMO_TODAY, 'd MMM');

/**
 * Marks a panel whose figures come from the sample layer rather than the
 * API, and names the date that data is anchored to. It sits on the header's
 * description line, so sample and live panels share one header height.
 */
function SampleDataLabel() {
  return (
    <Tooltip content={SAMPLE_NOTE}>
      <span
        tabIndex={0}
        aria-label={`Sample data as of ${format(DEMO_TODAY, 'd MMMM yyyy')}. ${SAMPLE_NOTE}`}
        className="inline-flex h-5 items-center gap-1.5 rounded-sm align-top font-medium text-ink-2"
      >
        <FlaskConical aria-hidden className="size-3.5 shrink-0" strokeWidth={2} />
        {`Sample data · as of ${SAMPLE_AS_OF}`}
      </span>
    </Tooltip>
  );
}

// ── Expense breakdown ────────────────────────────────────────────────────

const OTHER = 'Other categories';

/** Transactions for one expense category over exactly the period on screen. */
function categoryHref(category: string, from: string, to: string) {
  const params = new URLSearchParams({ category, type: 'expense', range: 'custom', from, to });
  return `/transactions?${params}`;
}

/**
 * Where the money went: a ring shaded from ink (the largest share) down the
 * grey ramp, with the exact share and amount of each category beside it.
 * Every category opens its own expenses for the period.
 */
export function ExpenseBreakdownPanel({
  data,
  periodLabel,
}: {
  data: DashboardResponse | undefined;
  periodLabel: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const breakdown = data?.expenseBreakdown;
  const currency = data?.currency;
  const items = (breakdown?.items ?? []).map((item) => ({
    ...item,
    name: item.category ?? OTHER,
  }));
  const activeItem = items.find((item) => item.name === active);

  return (
    <Panel className="@container p-5 sm:p-6" aria-labelledby="breakdown-title">
      <PanelHeader
        id="breakdown-title"
        title="Expense breakdown"
        actions={periodLabel && <span className="text-body-sm text-muted">{periodLabel}</span>}
      />
      {!breakdown || !data ? (
        <div className="mt-5 flex flex-col items-center gap-6 @md:flex-row">
          <Skeleton className="size-[156px] shrink-0 rounded-full" />
          <div className="w-full flex-1 space-y-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
      ) : items.length === 0 ? (
        <PanelNote>No expenses in this period.</PanelNote>
      ) : (
        <div className="mt-5 flex flex-col items-center gap-x-8 gap-y-5 @md:flex-row">
          <DonutChart
            ariaLabel="Expenses by category"
            size={156}
            thickness={25}
            active={active}
            onActiveChange={setActive}
            items={items.map((item, i) => ({
              id: item.name,
              label: item.name,
              value: item.cents,
              fill: rankFills[i] ?? 'fill-chart-6',
            }))}
            center={
              <>
                <span className="tabular text-body-lg font-semibold tracking-[-0.02em] text-ink">
                  {money(activeItem?.cents ?? breakdown.totalCents, { currency })}
                </span>
                <span className="max-w-[104px] truncate text-caption text-muted">
                  {activeItem?.name ?? 'Total'}
                </span>
              </>
            }
          />
          <ul
            className="w-full min-w-0 flex-1 divide-y divide-line"
            aria-label="Expense categories"
          >
            {items.map((item, i) => (
              <li
                key={item.name}
                onMouseEnter={() => setActive(item.name)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(item.name)}
                onBlur={() => setActive(null)}
                className={cn(
                  'flex items-baseline gap-3 py-2 transition-opacity duration-200',
                  active && active !== item.name && 'opacity-45',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'size-2.5 shrink-0 translate-y-px rounded-full',
                    rankSwatches[i] ?? 'bg-chart-6',
                  )}
                />
                {item.category === null ? (
                  <span className="min-w-0 flex-1 truncate text-body-sm text-ink-2">
                    {item.name}
                  </span>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-body-sm">
                    <Link
                      to={categoryHref(item.category, data.period.from, data.period.to)}
                      title={item.name}
                      className="rounded-sm text-ink-2 hover:text-ink hover:underline"
                    >
                      {item.name}
                    </Link>
                  </span>
                )}
                <span className="tabular shrink-0 text-body-sm font-medium text-ink">
                  {shareLabel(item.shareBasisPoints)}
                </span>
                <span className="tabular w-24 shrink-0 text-right text-body-sm text-muted">
                  {money(item.cents, { currency })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

// ── Recent transactions ──────────────────────────────────────────────────

/** The business's latest entries, newest first, whatever the period. */
export function RecentTransactionsPanel({ data }: { data: DashboardResponse | undefined }) {
  const today = data ? parseISO(data.today) : new Date();
  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="recent-title">
      <PanelHeader
        id="recent-title"
        className="items-start"
        title="Recent transactions"
        description="Newest first, whatever the period"
        actions={<ViewAll to="/transactions" label="View all transactions" />}
      />
      <div className="mt-2">
        {!data ? (
          <LedgerSkeleton />
        ) : data.recent.length === 0 ? (
          <PanelNote>No transactions recorded yet.</PanelNote>
        ) : (
          <ul aria-label="Latest transactions" className="divide-y divide-line">
            {data.recent.map((t) => (
              <LedgerRow
                key={t.id}
                icon={<TypeIcon type={t.type} />}
                title={t.description}
                subtitle={t.category}
                amount={
                  <Amount cents={t.amountCents} type={entryType(t.type)} currency={data.currency} />
                }
                meta={relativeDay(t.date, today, 'd MMM yyyy')}
              />
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

// ── Upcoming payments (sample data) ──────────────────────────────────────

/**
 * What is due next. The API does not schedule payments yet, so this panel
 * reads the TechStore sample layer and says so.
 */
export function UpcomingPaymentsPanel({ className }: { className?: string }) {
  const { data, isError, refetch } = useUpcomingPayments();
  return (
    <Panel className={cn('p-5 sm:p-6', className)} aria-labelledby="upcoming-title">
      <PanelHeader
        id="upcoming-title"
        className="items-start"
        title="Upcoming payments"
        description={<SampleDataLabel />}
        actions={<ViewAll to="/cash-flow#upcoming" label="View all upcoming payments" />}
      />
      <div className="mt-2">
        {isError ? (
          <ErrorState title="Could not load upcoming payments" onRetry={() => refetch()} />
        ) : !data ? (
          <LedgerSkeleton />
        ) : data.length === 0 ? (
          <PanelNote>Nothing is due in the next 30 days.</PanelNote>
        ) : (
          <ul aria-label="Upcoming payments" className="divide-y divide-line">
            {data.map((u) => {
              return (
                <LedgerRow
                  key={u.id}
                  icon={<TypeIcon type={u.type === 'income' ? 'INCOME' : 'EXPENSE'} />}
                  title={u.description}
                  subtitle={u.detail}
                  amount={
                    u.type === 'income' ? (
                      <Amount cents={u.amountCents} type="income" />
                    ) : (
                      <span className="tabular font-medium text-ink">{money(u.amountCents)}</span>
                    )
                  }
                  // Plain dates: the sample layer's "today" is not the real one.
                  meta={
                    <>
                      {u.certainty === 'estimated' && 'est. · '}
                      {formatDate(u.dueDate)}
                    </>
                  }
                />
              );
            })}
          </ul>
        )}
      </div>
    </Panel>
  );
}

// ── Scenario preview (sample data) ───────────────────────────────────────

/**
 * One what-if beside the current plan: where the balance ends in 90 days
 * either way. Simulations still run on the TechStore sample layer, so the
 * panel is labelled as sample data; the projection is drawn dashed.
 */
export function ScenarioPreviewPanel({ className }: { className?: string }) {
  const scenarios = useScenarios();
  const scenario = scenarios.data?.[0];
  const result = useScenarioResult(scenario?.id);
  const preview = result.data;
  const failed = scenarios.isError || result.isError;
  const delta = preview ? preview.scenarioEndCents - preview.baselineEndCents : 0;
  const horizon = `Balance in ${FORECAST_DAYS} days`;

  return (
    <Panel className={cn('flex flex-col p-5 sm:p-6', className)} aria-labelledby="scenario-title">
      <PanelHeader
        id="scenario-title"
        className="items-start"
        title="Scenario preview"
        description={<SampleDataLabel />}
        actions={<ViewAll to="/simulations" label="View all scenarios" />}
      />
      {failed ? (
        <ErrorState
          title="Could not load the scenario"
          onRetry={() => (scenarios.isError ? scenarios.refetch() : result.refetch())}
        />
      ) : !preview ? (
        <>
          <Skeleton className="mt-4 h-4 w-4/5" />
          <Skeleton className="mt-4 h-[156px] w-full rounded-field" />
          <Skeleton className="mt-auto h-11 w-full rounded-control" />
        </>
      ) : (
        <>
          <p className="mt-4 text-body-sm text-ink-2">{preview.scenario.description}</p>
          <div className="mt-4 grid grid-cols-2 divide-x divide-line rounded-field bg-sunken">
            <div className="min-w-0 p-4" role="group" aria-label="Current plan">
              <p className="min-h-10 text-body-sm text-ink-2">Current plan</p>
              <p className="tabular mt-1 text-figure-sm text-ink">
                {money(preview.baselineEndCents, { decimals: 0 })}
              </p>
              <p className="text-caption text-muted">{horizon}</p>
              <Sparkline
                values={preview.baseline.map((p) => p.balanceCents)}
                tone="ink"
                width={120}
                height={36}
                className="mt-3 h-9 w-full"
              />
            </div>
            <div className="min-w-0 p-4" role="group" aria-label={preview.scenario.name}>
              <p
                className="line-clamp-2 min-h-10 text-body-sm text-ink-2"
                title={preview.scenario.name}
              >
                {preview.scenario.name}
              </p>
              <p className="tabular mt-1 text-figure-sm text-ink">
                {money(preview.scenarioEndCents, { decimals: 0 })}
              </p>
              <p className="tabular text-caption text-muted">
                <span
                  className={cn(
                    'font-medium',
                    delta < 0 ? 'text-negative' : delta > 0 ? 'text-positive' : 'text-ink-2',
                  )}
                >
                  {money(delta, { decimals: 0, sign: 'always' })}
                </span>{' '}
                vs. plan
              </p>
              <Sparkline
                values={preview.projection.map((p) => p.balanceCents)}
                tone="ink"
                dashed
                width={120}
                height={36}
                className="mt-3 h-9 w-full"
              />
            </div>
          </div>
          <ul aria-label="Assumptions" className="mt-3 mb-5 divide-y divide-line">
            {preview.scenario.assumptions.map((assumption) => (
              <li key={assumption} className="py-2.5 text-body-sm text-ink-2">
                {assumption}
              </li>
            ))}
          </ul>
          <Button asChild variant="primary" size="lg" className="mt-auto w-full">
            <Link to={`/simulations?scenario=${preview.scenario.id}`}>
              <Play className="fill-current" />
              Run simulation
            </Link>
          </Button>
        </>
      )}
    </Panel>
  );
}
