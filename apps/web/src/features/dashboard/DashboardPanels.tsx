import { differenceInCalendarDays, parseISO } from 'date-fns';
import { ArrowRight, ChevronLeft, ChevronRight, Play, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Link } from 'react-router';
import { categories, DEMO_TODAY } from '../../api/finance';
import { DonutChart } from '../../components/charts/DonutChart';
import { Sparkline } from '../../components/charts/Sparkline';
import { Amount } from '../../components/finance/Amount';
import { rankFills, rankSwatches } from '../../components/finance/categoryVisuals';
import { LedgerRow, LedgerSkeleton } from '../../components/finance/LedgerRow';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { Panel, PanelHeader } from '../../components/ui/Panel';
import { Skeleton } from '../../components/ui/States';
import type { DashboardData } from '../../demo/api';
import { cn } from '../../lib/cn';
import { money, percent, relativeDay } from '../../lib/format';

const categoryName = Object.fromEntries(categories.map((c) => [c.id, c.name]));

function ViewAll({ to, label = 'View all' }: { to: string; label?: string }) {
  return (
    <Link
      to={to}
      className="group inline-flex items-center gap-1 rounded-md text-[13px] font-medium text-chart-1 hover:text-ink"
    >
      {label}
      <ArrowRight
        className="size-3.5 transition-transform group-hover:translate-x-0.5"
        strokeWidth={2}
      />
    </Link>
  );
}

// ── Insight ──────────────────────────────────────────────────────────────

export function InsightPanel({ insights }: { insights: DashboardData['insights'] | undefined }) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const insight = insights?.[index];
  const count = insights?.length ?? 0;

  const go = (step: number) => {
    setDirection(step);
    setIndex((i) => (i + step + count) % count);
  };

  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="insight-title" aria-roledescription="carousel">
      <header className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-[10px] bg-chart-1-soft text-chart-1">
          <Sparkles className="size-[18px]" strokeWidth={1.75} />
        </span>
        <h2 id="insight-title" className="flex-1 text-[16px] font-semibold text-ink">
          Montra insight
        </h2>
        {count > 1 && (
          <div className="flex items-center gap-1">
            <span className="tabular mr-1 text-[12px] text-muted" aria-live="polite">
              {index + 1}/{count}
            </span>
            <IconButton label="Previous insight" size="sm" onClick={() => go(-1)}>
              <ChevronLeft />
            </IconButton>
            <IconButton label="Next insight" size="sm" onClick={() => go(1)}>
              <ChevronRight />
            </IconButton>
          </div>
        )}
      </header>

      <div className="relative mt-5 min-h-[148px] overflow-hidden">
        {insight ? (
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={insight.id}
              custom={direction}
              initial={{ opacity: 0, x: direction * 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -16 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="text-[18px] leading-[1.45] font-medium tracking-[-0.01em] text-ink">
                {insight.lead}{' '}
                <span
                  className={cn(
                    'font-semibold',
                    insight.tone === 'positive' ? 'text-positive' : 'text-chart-1',
                  )}
                >
                  {insight.emphasis}
                </span>{' '}
                {insight.trail}
              </p>
              <p className="mt-2.5 text-[13px] leading-relaxed text-muted">{insight.body}</p>
              <Button
                asChild
                size="md"
                className="mt-5 border-chart-1/25 bg-chart-1-soft text-ink hover:border-chart-1/45 hover:bg-chart-1-soft"
              >
                <Link to={insight.action.to}>
                  {insight.action.label}
                  <ArrowRight />
                </Link>
              </Button>
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="space-y-3">
            <Skeleton className="h-5 w-11/12" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="mt-4 h-4 w-full" />
            <Skeleton className="mt-5 h-9 w-32" />
          </div>
        )}
      </div>
    </Panel>
  );
}

// ── Expense breakdown ────────────────────────────────────────────────────

export function ExpenseBreakdownPanel({
  breakdown,
  periodLabel,
}: {
  breakdown: DashboardData['expenseBreakdown'] | undefined;
  periodLabel: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const items = breakdown?.items ?? [];
  const activeItem = items.find((item) => item.name === active);

  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="breakdown-title">
      <PanelHeader
        id="breakdown-title"
        title="Expense breakdown"
        actions={<Badge>{periodLabel}</Badge>}
      />
      {breakdown ? (
        <div className="mt-5 flex items-center gap-5">
          <DonutChart
            ariaLabel="Expenses by category"
            size={136}
            thickness={18}
            active={active}
            onActiveChange={setActive}
            items={items.map((item, i) => ({
              id: item.name,
              label: item.name,
              value: item.cents,
              fill: rankFills[i] ?? 'fill-chart-2',
            }))}
            center={
              <>
                <span className="tabular text-[18px] font-semibold tracking-[-0.02em] text-ink">
                  {money(activeItem?.cents ?? breakdown.totalCents, { decimals: 0 })}
                </span>
                <span className="text-[12px] text-muted">{activeItem?.name ?? 'Total'}</span>
              </>
            }
          />
          <ul className="min-w-0 flex-1 space-y-2.5">
            {items.map((item, i) => (
              <li
                key={item.name}
                onMouseEnter={() => setActive(item.name)}
                onMouseLeave={() => setActive(null)}
                className={cn(
                  'flex items-start gap-2.5 transition-opacity',
                  active && active !== item.name && 'opacity-45',
                )}
              >
                <span className={cn('mt-[5px] size-2.5 shrink-0 rounded-full', rankSwatches[i])} />
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{item.name}</span>
                <span className="tabular shrink-0 text-right leading-tight">
                  <span className="block text-[13px] font-medium text-ink">
                    {percent(item.share)}
                  </span>
                  <span className="block text-[11px] text-muted">
                    {money(item.cents, { decimals: 0 })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-5 flex items-center gap-6">
          <Skeleton className="size-[136px] rounded-full" />
          <div className="flex-1 space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

// ── Recent transactions ──────────────────────────────────────────────────

export function RecentTransactionsPanel({ items }: { items: DashboardData['recent'] | undefined }) {
  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="recent-title">
      <PanelHeader
        id="recent-title"
        title="Recent transactions"
        actions={<ViewAll to="/transactions" />}
      />
      <div className="mt-3">
        {items ? (
          <ul>
            {items.map((t) => (
              <LedgerRow
                key={t.id}
                categoryId={t.categoryId}
                title={t.description}
                subtitle={categoryName[t.categoryId]}
                amount={<Amount cents={t.amountCents} type={t.type} />}
                meta={relativeDay(t.date, DEMO_TODAY)}
              />
            ))}
          </ul>
        ) : (
          <LedgerSkeleton />
        )}
      </div>
    </Panel>
  );
}

// ── Upcoming payments ────────────────────────────────────────────────────

export function UpcomingPaymentsPanel({ items }: { items: DashboardData['upcoming'] | undefined }) {
  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="upcoming-title">
      <PanelHeader
        id="upcoming-title"
        title="Upcoming payments"
        actions={<ViewAll to="/cash-flow#upcoming" />}
      />
      <div className="mt-3">
        {items ? (
          <ul>
            {items.map((u) => {
              const days = differenceInCalendarDays(parseISO(u.dueDate), DEMO_TODAY);
              return (
                <LedgerRow
                  key={u.id}
                  categoryId={u.categoryId}
                  title={u.description}
                  subtitle={u.detail}
                  amount={
                    u.type === 'income' ? (
                      <Amount cents={u.amountCents} type="income" />
                    ) : (
                      <span className="tabular font-medium text-ink">{money(u.amountCents)}</span>
                    )
                  }
                  meta={
                    <span
                      className={cn(
                        days <= 2 && u.type === 'expense' && 'font-medium text-warning',
                      )}
                    >
                      {u.certainty === 'estimated' && <span className="text-faint">est. · </span>}
                      {relativeDay(u.dueDate, DEMO_TODAY)}
                    </span>
                  }
                />
              );
            })}
          </ul>
        ) : (
          <LedgerSkeleton />
        )}
      </div>
    </Panel>
  );
}

// ── Scenario preview ─────────────────────────────────────────────────────

export function ScenarioPreviewPanel({
  preview,
}: {
  preview: DashboardData['scenarioPreview'] | undefined;
}) {
  const delta = preview ? preview.scenario.endCents - preview.baseline.endCents : 0;
  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="scenario-title">
      <PanelHeader
        id="scenario-title"
        title="Scenario preview"
        actions={<ViewAll to="/simulations" />}
      />
      {preview ? (
        <>
          <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-control border border-line">
            <div className="bg-sunken p-4">
              <p className="text-[12px] text-ink-2">{preview.baseline.label}</p>
              <p className="tabular mt-1.5 text-[20px] font-semibold tracking-[-0.02em] text-ink">
                {money(preview.baseline.endCents, { decimals: 0 })}
              </p>
              <p className="text-[11px] text-muted">{preview.horizonLabel}</p>
              <Sparkline
                values={preview.baseline.trend}
                tone="analytic"
                width={120}
                height={34}
                className="mt-3 w-full"
              />
            </div>
            <div className="border-l border-line bg-sunken p-4">
              <p className="truncate text-[12px] text-ink-2" title={preview.scenario.label}>
                {preview.scenario.label}
              </p>
              <p
                className={cn(
                  'tabular mt-1.5 text-[20px] font-semibold tracking-[-0.02em]',
                  delta < 0 ? 'text-negative' : 'text-positive',
                )}
              >
                {money(preview.scenario.endCents, { decimals: 0 })}
              </p>
              <p className="tabular text-[11px] text-muted">
                {money(delta, { decimals: 0, sign: 'always' })} vs. plan
              </p>
              <Sparkline
                values={preview.scenario.trend}
                tone="analytic"
                dashed
                width={120}
                height={34}
                className="mt-3 w-full"
              />
            </div>
          </div>
          <Button asChild variant="analytic" size="lg" className="mt-4 w-full">
            <Link to={`/simulations?scenario=${preview.scenario.id}`}>
              <Play className="fill-current" />
              Run simulation
            </Link>
          </Button>
        </>
      ) : (
        <>
          <Skeleton className="mt-5 h-[142px] w-full rounded-control" />
          <Skeleton className="mt-4 h-11 w-full rounded-control" />
        </>
      )}
    </Panel>
  );
}
