import { FORECAST_DAYS, type DashboardResponse } from '@montra/shared';
import { parseISO } from 'date-fns';
import { ArrowRight, Play } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useCashFlow, useScenarioPresets, useSimulation } from '../../api/finance';
import { DonutChart } from '../../components/charts/DonutChart';
import { Sparkline } from '../../components/charts/Sparkline';
import { Amount } from '../../components/finance/Amount';
import { rankFills, rankSwatches } from '../../components/finance/categoryVisuals';
import { LedgerRow, LedgerSkeleton } from '../../components/finance/LedgerRow';
import { Button } from '../../components/ui/Button';
import { Panel, PanelHeader } from '../../components/ui/Panel';
import { ErrorState, Skeleton } from '../../components/ui/States';
import { cn } from '../../lib/cn';
import { useMessages } from '../../i18n';
import { money, relativeDay } from '../../lib/format';
import { entryType } from '../transactions/display';
import { TypeIcon } from '../transactions/TypeIcon';
import { useCurrentMembership } from '../auth/currentUser';
import { describeScenario } from '../simulations/describe';
import { dashboardMessages } from './messages';
import { shareLabel } from './period';

function ViewAll({ to, label }: { to: string; label: string }) {
  const m = useMessages(dashboardMessages).panels;
  return (
    <Link
      to={to}
      aria-label={label}
      className="group inline-flex items-center gap-1.5 rounded-md text-body-sm font-medium whitespace-nowrap text-ink hover:underline"
    >
      {m.viewAll}
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

// ── Expense breakdown ────────────────────────────────────────────────────

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
  noData = false,
}: {
  data: DashboardResponse | undefined;
  periodLabel: string;
  /** No transactions at all: an empty ring in place of the donut, and no legend. */
  noData?: boolean;
}) {
  const [active, setActive] = useState<string | null>(null);
  const m = useMessages(dashboardMessages).panels;
  const breakdown = data?.expenseBreakdown;
  const currency = data?.currency;
  const items = (breakdown?.items ?? []).map((item) => ({
    ...item,
    name: item.category ?? m.otherCategories,
  }));
  const activeItem = items.find((item) => item.name === active);

  return (
    <Panel className="@container p-5 sm:p-6" aria-labelledby="breakdown-title">
      <PanelHeader
        id="breakdown-title"
        // Title at the top, as in the overview beside it, with the period on its baseline.
        className="items-baseline"
        title={m.breakdown}
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
      ) : noData ? (
        <div className="mt-5 flex flex-col items-center gap-x-8 gap-y-4 @md:flex-row">
          <div
            aria-hidden
            className="size-[156px] shrink-0 rounded-full border-[25px] border-chart-track"
          />
          <p className="text-body text-muted">{m.noExpensesYet}</p>
        </div>
      ) : items.length === 0 ? (
        <PanelNote>{m.noExpenses}</PanelNote>
      ) : (
        <div className="mt-5 flex flex-col items-center gap-x-8 gap-y-5 @md:flex-row">
          <DonutChart
            ariaLabel={m.expensesByCategory}
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
                  {activeItem?.name ?? m.total}
                </span>
              </>
            }
          />
          <ul
            className="w-full min-w-0 flex-1 divide-y divide-line"
            aria-label={m.expenseCategories}
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
export function RecentTransactionsPanel({
  data,
  noData = false,
}: {
  data: DashboardResponse | undefined;
  /** No transactions at all: no "View all", which would open an empty list. */
  noData?: boolean;
}) {
  const today = data ? parseISO(data.today) : new Date();
  const m = useMessages(dashboardMessages).panels;
  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="recent-title">
      <PanelHeader
        id="recent-title"
        className="items-start"
        title={m.recent}
        description={m.recentHint}
        actions={!noData && <ViewAll to="/transactions" label={m.viewAllTransactions} />}
      />
      <div className="mt-2">
        {!data ? (
          <LedgerSkeleton />
        ) : data.recent.length === 0 ? (
          <PanelNote>{m.noneRecorded}</PanelNote>
        ) : (
          <ul aria-label={m.latest} className="divide-y divide-line">
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

// ── Before the first transaction ─────────────────────────────────────────

/**
 * Stands in for a forward-looking panel while the business has no
 * transactions at all. It reads nothing: the TechStore sample layer must
 * never reach a real account that has not recorded anything yet.
 */
export function NotYetPanel({
  id,
  title,
  note,
  className,
}: {
  id: string;
  title: string;
  note: string;
  className?: string;
}) {
  return (
    <Panel className={cn('p-5 sm:p-6', className)} aria-labelledby={id}>
      <PanelHeader id={id} title={title} />
      <PanelNote>{note}</PanelNote>
    </Panel>
  );
}

// ── Upcoming payments ────────────────────────────────────────────────────

/** What is due next: the business's own recurring payments and transactions dated ahead. */
export function UpcomingPaymentsPanel({ className }: { className?: string }) {
  const { business } = useCurrentMembership();
  const { data, isError, refetch } = useCashFlow(business.id);
  const m = useMessages(dashboardMessages).panels;
  const items = data?.upcoming.slice(0, 5);
  const today = data ? parseISO(data.today) : new Date();
  return (
    <Panel className={cn('p-5 sm:p-6', className)} aria-labelledby="upcoming-title">
      <PanelHeader
        id="upcoming-title"
        className="items-start"
        title={m.upcoming}
        description={m.upcomingHint}
        actions={<ViewAll to="/cash-flow#upcoming" label={m.viewAllUpcoming} />}
      />
      <div className="mt-2">
        {isError ? (
          <ErrorState title={m.upcomingError} onRetry={() => refetch()} />
        ) : !data || !items ? (
          <LedgerSkeleton />
        ) : items.length === 0 ? (
          <PanelNote>{m.nothingDue}</PanelNote>
        ) : (
          <ul aria-label={m.upcoming} className="divide-y divide-line">
            {items.map((u) => (
              <LedgerRow
                key={u.id}
                icon={<TypeIcon type={u.type} />}
                title={u.description}
                subtitle={u.category}
                amount={
                  u.type === 'INCOME' ? (
                    <Amount cents={u.amountCents} type="income" currency={data.currency} />
                  ) : (
                    <span className="tabular font-medium text-ink">
                      {money(u.amountCents, { currency: data.currency })}
                    </span>
                  )
                }
                meta={
                  <>
                    {u.certainty === 'estimated' && m.estimated}
                    {relativeDay(u.dueDate, today, 'd MMM')}
                  </>
                }
              />
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

// ── Scenario preview ─────────────────────────────────────────────────────

/**
 * One what-if beside the current plan: where the balance ends in 90 days
 * either way, from the business's own forecast. The projection is drawn dashed.
 */
export function ScenarioPreviewPanel({ className }: { className?: string }) {
  const { business } = useCurrentMembership();
  const presets = useScenarioPresets(business.id);
  const preset = presets.data?.presets[0];
  const result = useSimulation(business.id, preset?.rule);
  const preview = result.data;
  const failed = presets.isError || result.isError;
  const delta = preview ? preview.scenarioEndCents - preview.baselineEndCents : 0;
  const m = useMessages(dashboardMessages).panels;
  const horizon = m.balanceIn(FORECAST_DAYS);
  const text =
    preset && preview
      ? describeScenario(preset, {
          currency: preview.currency,
          today: preview.today,
        })
      : undefined;
  const fmt = (cents: number, sign: 'auto' | 'always' = 'auto') =>
    money(cents, { decimals: 0, sign, currency: preview?.currency });

  return (
    <Panel className={cn('flex flex-col p-5 sm:p-6', className)} aria-labelledby="scenario-title">
      <PanelHeader
        id="scenario-title"
        className="items-start"
        title={m.scenario}
        description={m.scenarioHint}
        actions={<ViewAll to="/simulations" label={m.viewAllScenarios} />}
      />
      {failed ? (
        <ErrorState
          title={m.scenarioError}
          onRetry={() => (presets.isError ? presets.refetch() : result.refetch())}
        />
      ) : presets.data && !preset ? (
        <PanelNote>{m.noScenario}</PanelNote>
      ) : !preview || !text || !preset ? (
        <>
          <Skeleton className="mt-4 h-4 w-4/5" />
          <Skeleton className="mt-4 h-[156px] w-full rounded-field" />
          <Skeleton className="mt-auto h-11 w-full rounded-control" />
        </>
      ) : (
        <>
          <p className="mt-4 text-body-sm text-ink-2">{text.description}</p>
          {/* The two sides share rows, so their figures line up however their labels wrap. */}
          <div className="mt-4 grid grid-cols-2 grid-rows-[repeat(4,auto)] divide-x divide-line rounded-field bg-sunken">
            <div
              className="row-span-4 grid min-w-0 grid-rows-subgrid p-4"
              role="group"
              aria-label={m.currentPlan}
            >
              <p className="text-body-sm text-ink-2">{m.currentPlan}</p>
              <p className="tabular mt-1 text-figure-sm text-ink">
                {fmt(preview.baselineEndCents)}
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
            <div
              className="row-span-4 grid min-w-0 grid-rows-subgrid p-4"
              role="group"
              aria-label={text.name}
            >
              <p className="line-clamp-2 text-body-sm text-ink-2" title={text.name}>
                {text.name}
              </p>
              <p className="tabular mt-1 text-figure-sm text-ink">
                {fmt(preview.scenarioEndCents)}
              </p>
              <p className="tabular text-caption text-muted">
                <span
                  className={cn(
                    'font-medium',
                    delta < 0 ? 'text-negative' : delta > 0 ? 'text-positive' : 'text-ink-2',
                  )}
                >
                  {fmt(delta, 'always')}
                </span>{' '}
                {m.vsPlan}
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
          <div className="mt-4 mb-5">
            <h3 id="scenario-assumptions" className="text-caption text-muted">
              {m.assumptions}
            </h3>
            <ul aria-labelledby="scenario-assumptions" className="divide-y divide-line">
              {text.assumptions.map((assumption) => (
                <li key={assumption} className="py-2 text-body-sm text-ink-2">
                  {assumption}
                </li>
              ))}
            </ul>
          </div>
          <Button asChild variant="primary" size="lg" className="mt-auto w-full">
            <Link to={`/simulations?scenario=${preset.id}`}>
              <Play className="fill-current" />
              {m.run}
            </Link>
          </Button>
        </>
      )}
    </Panel>
  );
}
