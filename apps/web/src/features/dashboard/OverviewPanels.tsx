import { isoDaysBetween } from '@montra/shared';
import { parseISO } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Link } from 'react-router';
import { useBudgets, useCashFlow } from '../../api/finance';
import { Panel, PanelHeader } from '../../components/ui/Panel';
import { ErrorState, Skeleton } from '../../components/ui/States';
import { useMessages } from '../../i18n';
import { cn } from '../../lib/cn';
import { decimal, money, percent, relativeDay } from '../../lib/format';
import { useCurrentMembership } from '../auth/currentUser';
import { dashboardMessages } from './messages';

const ease = [0.22, 1, 0.36, 1] as const;

/** The longest runway the gauge draws; more than this fills it. */
const RUNWAY_SCALE = 6;

/**
 * How long the cash in the bank today would last at the business's average
 * monthly spending, with nothing coming in: the classic runway, drawn as a
 * tall capsule filling from the bottom (the chart's capsule, stood upright).
 * Under a month reads as a warning, in words as well as colour.
 */
export function RunwayPanel({ className }: { className?: string }) {
  const { business } = useCurrentMembership();
  const { data } = useCashFlow(business.id);
  const m = useMessages(dashboardMessages).runway;
  const reduceMotion = useReducedMotion();

  const stats = data?.stats;
  // The months the expense total covers: twelve, or fewer for a newer ledger.
  const months = stats
    ? Math.min(12, Math.max(1, isoDaysBetween(stats.openingDate, data.today) / 30.44))
    : 0;
  const monthly = stats ? stats.expenseCents / months : 0;
  const noData = data !== undefined && (data.transactionCount === 0 || monthly <= 0);
  const runway = stats && monthly > 0 ? Math.max(0, stats.closingCents / monthly) : 0;
  const fill = Math.min(1, runway / RUNWAY_SCALE);
  const low = !noData && runway < 1;
  const shown = decimal(runway, runway < 10 ? 1 : 0);

  return (
    <Panel className={cn('flex flex-col p-5 sm:p-6', className)} aria-labelledby="runway-title">
      <PanelHeader id="runway-title" title={m.title} description={m.description} />
      <div className="mt-6 flex flex-1 gap-6">
        {/* The gauge: a pale upright track, the ink capsule rising from its foot. */}
        <div className="relative flex shrink-0 gap-2.5">
          <div
            role="img"
            aria-label={noData || !stats ? m.title : m.gauge(shown)}
            className="relative h-full min-h-48 w-11 overflow-hidden rounded-full bg-chart-track"
          >
            {stats && !noData && (
              <motion.div
                className={cn(
                  'absolute inset-x-0 bottom-0 rounded-full',
                  low ? 'bg-negative' : 'bg-chart-1',
                )}
                initial={reduceMotion ? false : { height: 0 }}
                animate={{ height: `max(${fill * 100}%, ${fill > 0 ? '2.75rem' : '0px'})` }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.6, ease }}
              />
            )}
          </div>
          <div aria-hidden className="relative w-8 text-caption text-muted">
            {[RUNWAY_SCALE, 3, 1].map((n) => (
              <span
                key={n}
                className="tabular absolute left-0 -translate-y-1/2"
                style={{ bottom: `calc(${(n / RUNWAY_SCALE) * 100}% - 0.5rem)` }}
              >
                {m.scale(n)}
              </span>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-end">
          {!data ? (
            <Skeleton className="h-10 w-32" />
          ) : noData ? (
            <p className="text-body-sm text-muted">{m.noData}</p>
          ) : (
            <>
              {/* The number large, the unit beside it: it stays on one line in the narrow panel. */}
              <p className={cn('tabular text-figure-xl', low ? 'text-negative' : 'text-ink')}>
                {runway >= RUNWAY_SCALE * 4 ? `${RUNWAY_SCALE * 4}+` : shown}
                <span className="ml-1.5 text-title font-medium text-muted">
                  {runway === 1 ? m.unitOne : m.unit}
                </span>
              </p>
              <p className="mt-2 text-body-sm text-muted">
                {(stats?.closingCents ?? 0) <= 0
                  ? m.none
                  : low
                    ? m.short
                    : m.body(money(monthly, { decimals: 0, currency: data.currency }))}
              </p>
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}

/**
 * This month's budgets as one ring: the share of the total limit spent so
 * far, the amounts and the days left. Over the limit, the ring and the line
 * beneath turn red and say by how much.
 */
export function BudgetRingPanel({ className }: { className?: string }) {
  const { business, role } = useCurrentMembership();
  const { data } = useBudgets(business.id, undefined);
  const m = useMessages(dashboardMessages).budgetRing;
  const reduceMotion = useReducedMotion();
  const size = 128;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const limit = data?.totalLimitCents ?? 0;
  const spent = data?.totalSpentCents ?? 0;
  const share = limit > 0 ? spent / limit : 0;
  const over = spent > limit && limit > 0;
  const fmt = (cents: number) => money(cents, { decimals: 0, currency: data?.currency });

  return (
    <Panel
      className={cn('flex flex-col p-5 sm:p-6', className)}
      aria-labelledby="budget-ring-title"
    >
      <PanelHeader
        id="budget-ring-title"
        className="min-h-0 flex-nowrap items-start"
        title={m.title}
        actions={
          data &&
          data.lines.length > 0 && (
            <Link
              to="/budgets"
              aria-label={m.open}
              className="text-muted transition-colors hover:text-ink"
            >
              <ArrowRight aria-hidden className="size-4" strokeWidth={1.75} />
            </Link>
          )
        }
      />
      {!data ? (
        <Skeleton className="mx-auto mt-6 size-32 rounded-full" />
      ) : data.lines.length === 0 ? (
        <div className="mt-4 flex flex-1 flex-col justify-between gap-4">
          <div>
            <p className="text-body font-medium text-ink">{m.none}</p>
            <p className="mt-1 text-body-sm text-muted">{m.noneBody}</p>
          </div>
          {role === 'OWNER' && (
            <Link
              to="/budgets"
              className="text-body-sm font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
            >
              {m.set}
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-4 flex flex-1 flex-col items-center justify-center gap-4">
          <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} aria-hidden className="-rotate-90">
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                strokeWidth={stroke}
                className="stroke-chart-track"
              />
              <motion.circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                strokeWidth={stroke}
                strokeLinecap="round"
                className={over ? 'stroke-negative' : 'stroke-chart-1'}
                strokeDasharray={circumference}
                initial={reduceMotion ? false : { strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: circumference * (1 - Math.min(1, share)) }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.6, ease }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn('tabular text-figure-sm', over ? 'text-negative' : 'text-ink')}>
                {percent(share)}
              </span>
              <span className="text-caption text-muted">{m.used}</span>
            </div>
          </div>
          <div className="text-center">
            <p className="tabular text-body-sm font-medium text-ink">
              {m.of(fmt(spent), fmt(limit))}
            </p>
            <p className={cn('tabular text-body-sm', over ? 'text-negative' : 'text-muted')}>
              {over ? m.over(fmt(spent - limit)) : m.daysLeft(data.daysInMonth - data.daysElapsed)}
            </p>
          </div>
        </div>
      )}
    </Panel>
  );
}

/** At most this many payments are drawn on the timeline. */
const TIMELINE_ROWS = 8;

/**
 * The next payments as a vertical timeline: a hairline running down the
 * panel, a dot for each payment (filled when scheduled, hollow when
 * estimated), its date, what it is and how much, and the balance after it.
 * The next 30 days, up to eight payments; Cash flow has the full list.
 */
export function ComingUpPanel({ className }: { className?: string }) {
  const { business } = useCurrentMembership();
  const { data, isError, refetch } = useCashFlow(business.id);
  const m = useMessages(dashboardMessages).comingUp;
  const fmt = (cents: number) => money(cents, { decimals: 0, currency: data?.currency });
  const horizon = data
    ? data.upcoming.filter((u) => isoDaysBetween(data.today, u.dueDate) <= 30)
    : [];
  const items = horizon.slice(0, TIMELINE_ROWS);
  const today = data ? parseISO(data.today) : new Date();

  return (
    <Panel className={cn('flex flex-col p-5 sm:p-6', className)} aria-labelledby="coming-up-title">
      <PanelHeader
        id="coming-up-title"
        className="min-h-0 flex-nowrap items-start"
        title={m.title}
        description={m.description}
        actions={
          <Link
            to="/cash-flow#upcoming"
            aria-label={m.viewAllLabel}
            className="group inline-flex items-center gap-1.5 text-body-sm leading-6 font-medium whitespace-nowrap text-ink hover:underline"
          >
            {m.viewAll}
            <ArrowRight
              aria-hidden
              className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
              strokeWidth={2}
            />
          </Link>
        }
      />
      <div className="mt-5 flex-1">
        {isError ? (
          <ErrorState title={m.error} onRetry={() => refetch()} className="py-8" />
        ) : !data ? (
          <div className="space-y-5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-body-sm text-muted">
            {data.transactionCount === 0 ? m.noData : m.none}
          </p>
        ) : (
          <ol aria-label={m.title} className="relative">
            {/* The spine the payments hang from. */}
            <span aria-hidden className="absolute top-2 bottom-2 left-[5px] w-px bg-line" />
            {items.map((u) => (
              <li key={u.id} className="relative flex gap-4 pb-5 last:pb-0">
                <span
                  aria-hidden
                  className={cn(
                    'relative mt-1.5 size-[11px] shrink-0 rounded-full border-2',
                    u.certainty === 'scheduled'
                      ? 'border-chart-1 bg-chart-1'
                      : 'border-chart-1 bg-surface',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="tabular text-caption text-muted">
                    {relativeDay(u.dueDate, today, 'EEE d MMM')}
                    {u.certainty === 'estimated' && ` · ${m.estimated}`}
                  </p>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-body text-ink" title={u.description}>
                      {u.description}
                    </p>
                    <p
                      className={cn(
                        'tabular shrink-0 text-body font-medium',
                        u.type === 'INCOME' ? 'text-positive' : 'text-ink',
                      )}
                    >
                      {money(u.type === 'INCOME' ? u.amountCents : -u.amountCents, {
                        decimals: 0,
                        sign: 'always',
                        currency: data.currency,
                      })}
                    </p>
                  </div>
                  <p className="tabular text-caption text-muted">
                    {m.after(fmt(u.balanceAfterCents))}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Panel>
  );
}
