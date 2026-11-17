import { TRANSACTION_DATE_MAX, TRANSACTION_DATE_MIN, type DashboardPeriod } from '@montra/shared';
import { CalendarRange, Plus, ReceiptText } from 'lucide-react';
import { Link } from 'react-router';
import { errorMessage } from '../../api/client';
import { useDashboardSummary } from '../../api/dashboard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel } from '../../components/ui/Panel';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { cn } from '../../lib/cn';
import { useMessages } from '../../i18n';
import { count, greeting } from '../../lib/format';
import { useUiStore } from '../../stores/ui';
import { firstName } from '../auth/access';
import { useCurrentMembership, useSignedInUser } from '../auth/currentUser';
import { CashFlowOverview } from './CashFlowOverview';
import {
  ExpenseBreakdownPanel,
  RecentTransactionsPanel,
  ScenarioPreviewPanel,
  UpcomingPaymentsPanel,
} from './DashboardPanels';
import { KpiCards } from './KpiCards';
import { dashboardMessages } from './messages';
import { customRangeProblem, describePeriod, rangeLabel } from './period';

/** The rolling periods one tap away; the date-range menu in the top bar holds the rest. */
const QUICK_RANGES = ['7d', '30d', '90d'] as const;

/**
 * The dashboard: the period's net cash flow, income and expenses; how the
 * period ran, bar by bar; where the money went; the latest entries; and what
 * comes next. Everything is live from the API except the two forward-looking
 * panels, which are labelled as sample data.
 */
export function DashboardPage() {
  const { user } = useSignedInUser();
  const { business, role } = useCurrentMembership();
  const params = useUiStore((s) => s.period);
  const setPeriod = useUiStore((s) => s.setPeriod);
  const m = useMessages(dashboardMessages);
  const quickRanges = QUICK_RANGES.map((value) => ({ value, label: m.quickRanges[value] }));

  const rangeProblem = customRangeProblem(params);
  const { data, isError, error, isPlaceholderData, refetch } = useDashboardSummary(
    business.id,
    params,
    { enabled: !rangeProblem },
  );
  const shown = rangeProblem ? undefined : data;
  const text = shown && describePeriod(shown.period.period, shown.period);

  const noTransactions = shown !== undefined && shown.recent.length === 0;

  return (
    <div className="flex flex-col gap-6 lg:gap-7">
      <PageHeader
        title={`${greeting()}, ${firstName(user.name)}`}
        description={
          text ? (
            <>
              <span className="block">{m.header.performed(business.name, text.phrase)}</span>
              <span className="tabular mt-1 block text-body-sm text-muted">
                {rangeLabel(shown.period.from, shown.period.to)} ·{' '}
                {m.header.transactions(
                  count(shown.overview.transactionCount),
                  shown.overview.transactionCount,
                )}
              </span>
            </>
          ) : (
            <>{m.header.doing(business.name)}</>
          )
        }
        actions={
          <div className="flex w-full flex-wrap items-center justify-end gap-3 sm:w-auto">
            {params.period === 'custom' && (
              <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:flex sm:w-auto">
                <Input
                  type="date"
                  aria-label={m.header.fromDate}
                  aria-invalid={rangeProblem ? true : undefined}
                  min={TRANSACTION_DATE_MIN}
                  max={TRANSACTION_DATE_MAX}
                  value={params.from ?? ''}
                  onChange={(e) => setPeriod({ ...params, from: e.target.value || undefined })}
                  className="sm:w-[150px]"
                />
                <span className="text-body-sm text-muted">{m.header.to}</span>
                <Input
                  type="date"
                  aria-label={m.header.toDate}
                  aria-invalid={rangeProblem ? true : undefined}
                  min={TRANSACTION_DATE_MIN}
                  max={TRANSACTION_DATE_MAX}
                  value={params.to ?? ''}
                  onChange={(e) => setPeriod({ ...params, to: e.target.value || undefined })}
                  className="sm:w-[150px]"
                />
              </div>
            )}
            <SegmentedControl<DashboardPeriod>
              label={m.header.quickPeriod}
              value={params.period}
              onChange={(period) => setPeriod({ period })}
              options={quickRanges}
              className="flex w-full sm:inline-flex sm:w-auto"
            />
          </div>
        }
      />

      {rangeProblem ? (
        <Panel>
          <EmptyState icon={CalendarRange} title={m.states.checkRange} body={rangeProblem} />
        </Panel>
      ) : isError ? (
        <Panel>
          <ErrorState title={errorMessage(error, m.states.loadError)} onRetry={() => refetch()} />
        </Panel>
      ) : noTransactions ? (
        <Panel>
          <EmptyState
            icon={ReceiptText}
            title={m.states.empty}
            body={role === 'OWNER' ? m.states.emptyOwner : m.states.emptyViewer}
            action={
              role === 'OWNER' && (
                <Button asChild variant="primary">
                  <Link to="/transactions">
                    <Plus />
                    {m.states.addOrImport}
                  </Link>
                </Button>
              )
            }
          />
        </Panel>
      ) : (
        <div
          aria-busy={isPlaceholderData}
          className={cn(
            'flex flex-col gap-4 transition-opacity duration-200 sm:gap-6',
            isPlaceholderData && 'opacity-60',
          )}
        >
          <KpiCards data={shown} comparisonLabel={text?.comparison ?? ''} />

          <div className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,352px)]">
            <CashFlowOverview data={shown} periodLabel={text?.label ?? ''} />
            <ExpenseBreakdownPanel data={shown} periodLabel={text?.label ?? ''} />
          </div>

          <div className="grid gap-4 sm:gap-6 md:grid-cols-2 wide:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(320px,352px)]">
            <RecentTransactionsPanel data={shown} />
            <UpcomingPaymentsPanel />
            <ScenarioPreviewPanel className="md:col-span-2 wide:col-span-1" />
          </div>
        </div>
      )}
    </div>
  );
}
