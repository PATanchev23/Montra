import { AlertTriangle, ArrowUpRight, Check, CircleCheck, Clock, Plus, Upload } from 'lucide-react';
import { Link } from 'react-router';
import { useBudgets, useCashFlow } from '../../api/finance';
import { Button } from '../../components/ui/Button';
import { Panel, PanelHeader } from '../../components/ui/Panel';
import { ErrorState, Skeleton } from '../../components/ui/States';
import { useMessages } from '../../i18n';
import { cn } from '../../lib/cn';
import { useCurrentMembership } from '../auth/currentUser';
import { useNotices, type Notice } from '../notifications/notices';
import { dashboardMessages } from './messages';

/** At most this many alerts are listed; the bell in the top bar holds the rest. */
const ROWS = 5;

/**
 * What needs doing, beside how the period ran: the same alerts as the
 * notification bell (a payment due soon, a budget over its limit, a low
 * balance ahead), each a link to the page that resolves it. When nothing is
 * wrong it says so plainly. A business with no transactions yet gets the
 * first steps instead, each marked once done. An owner has Add transaction
 * and Import at the foot; a viewer, who can do neither, only reads.
 */
export function AttentionPanel({ noData, className }: { noData: boolean; className?: string }) {
  const { role } = useCurrentMembership();
  const canEdit = role === 'OWNER';
  const m = useMessages(dashboardMessages).attention;

  return (
    <Panel className={cn('flex flex-col p-5 sm:p-6', className)} aria-labelledby="attention-title">
      <PanelHeader
        id="attention-title"
        title={noData && canEdit ? m.start : m.title}
        description={noData && canEdit ? m.startDescription : m.description}
      />
      <div className="mt-4 flex-1">
        {noData ? canEdit ? <FirstSteps /> : <Quiet text={m.viewerStart} /> : <Notices />}
      </div>
      {canEdit && (
        <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
          <Button asChild size="sm">
            <Link to="/transactions?new=1">
              <Plus />
              {m.addTransaction}
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/transactions?import=new">
              <Upload />
              {m.import}
            </Link>
          </Button>
        </div>
      )}
    </Panel>
  );
}

function Notices() {
  const m = useMessages(dashboardMessages).attention;
  const { notices, loading, failed } = useNotices();
  if (failed) return <ErrorState title={m.error} className="py-8" />;
  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }
  if (notices.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 py-2">
        <CircleCheck aria-hidden className="size-6 text-positive" strokeWidth={1.5} />
        <div>
          <p className="text-body font-medium text-ink">{m.none}</p>
          <p className="mt-1 max-w-sm text-body-sm text-muted">{m.noneBody}</p>
        </div>
      </div>
    );
  }
  return (
    <ul aria-label={m.title} className="-mx-2 divide-y divide-line">
      {notices.slice(0, ROWS).map((notice) => (
        <NoticeRow key={notice.id} notice={notice} />
      ))}
    </ul>
  );
}

/** One alert as a link: what, the detail, when, and the way to the page that resolves it. */
function NoticeRow({ notice }: { notice: Notice }) {
  const m = useMessages(dashboardMessages).attention;
  const Icon = notice.tone === 'warning' ? Clock : AlertTriangle;
  return (
    <li>
      <Link
        to={notice.to}
        aria-label={m.open(notice.title)}
        className="group flex items-start gap-3 rounded-control px-2 py-3 transition-colors duration-150 hover:bg-hover/60"
      >
        {/* The glyph says what kind of alert it is; colour only repeats it. */}
        <Icon
          aria-hidden
          className={cn(
            'mt-0.5 size-4 shrink-0',
            notice.tone === 'warning' ? 'text-warning' : 'text-negative',
          )}
          strokeWidth={1.75}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-body font-medium text-ink">{notice.title}</span>
          <span className="tabular block text-body-sm text-muted">
            {notice.body} · {notice.time}
          </span>
        </span>
        <ArrowUpRight
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-muted transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink"
          strokeWidth={1.75}
        />
      </Link>
    </li>
  );
}

/**
 * For a business with no transactions yet: what Montra needs before it can
 * forecast, in order, each step marked once the figures show it is done.
 */
function FirstSteps() {
  const { business } = useCurrentMembership();
  const m = useMessages(dashboardMessages).attention;
  const cashFlow = useCashFlow(business.id).data;
  const budgets = useBudgets(business.id, undefined).data;
  const steps = [
    {
      title: m.steps.transactions,
      hint: m.steps.transactionsHint,
      to: '/transactions?import=new',
      done: (cashFlow?.transactionCount ?? 0) > 0,
    },
    {
      title: m.steps.balance,
      hint: m.steps.balanceHint,
      to: '/cash-flow',
      done: cashFlow?.settings.balanceCents != null,
    },
    {
      title: m.steps.budgets,
      hint: m.steps.budgetsHint,
      to: '/budgets',
      done: (budgets?.lines.length ?? 0) > 0,
    },
  ];
  return (
    <ol className="-mx-2 divide-y divide-line">
      {steps.map((step, i) => (
        <li key={step.title}>
          <Link
            to={step.to}
            className="group flex items-start gap-3 rounded-control px-2 py-3 transition-colors duration-150 hover:bg-hover/60"
          >
            <span
              aria-hidden
              className={cn(
                'tabular flex size-6 shrink-0 items-center justify-center rounded-full text-caption font-medium',
                step.done ? 'bg-accent text-accent-ink' : 'bg-hover text-ink-2',
              )}
            >
              {step.done ? <Check className="size-3.5" strokeWidth={2.5} /> : i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-body font-medium text-ink">
                {step.title}
                {step.done && <span className="sr-only"> ({m.done})</span>}
              </span>
              <span className="block text-body-sm text-muted">{step.hint}</span>
            </span>
            <ArrowUpRight
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-muted transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink"
              strokeWidth={1.75}
            />
          </Link>
        </li>
      ))}
    </ol>
  );
}

function Quiet({ text }: { text: string }) {
  return <p className="py-2 text-body-sm text-muted">{text}</p>;
}
