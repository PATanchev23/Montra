import type { DashboardPeriod } from '@montra/shared';
import { CalendarRange, Plus, Upload } from 'lucide-react';
import { Link } from 'react-router';
import { errorMessage } from '../../api/client';
import { useDashboardSummary } from '../../api/dashboard';
import { Button } from '../../components/ui/Button';
import { DatePicker } from '../../components/ui/DatePicker';
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
  NotYetPanel,
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
 *
 * A business with no transactions at all keeps the same layout, so nothing
 * jumps when the first import lands: the tiles show €0.00 with "No data yet",
 * the charts step back behind a note, and the sample panels give way to plain
 * notes (sample data never reaches an account that has recorded nothing). An
 * owner is offered Import and Add transaction; a viewer, who can do neither,
 * is just told there is nothing yet. A period that is merely empty is not
 * this case: its zeros and comparison are real and shown as they are.
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

  const canEdit = role === 'OWNER';
  const noData = shown !== undefined && shown.overview.totalTransactionCount === 0;

  return (
    <div className="flex flex-col gap-6 lg:gap-7">
      <PageHeader
        title={`${greeting()}, ${firstName(user.name)}`}
        description={
          text ? (
            <>
              <span className="block">
                {noData
                  ? canEdit
                    ? m.header.startOwner(business.name)
                    : m.header.startViewer
                  : m.header.performed(business.name, text.phrase)}
              </span>
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
            {noData && canEdit && (
              <div className="flex w-full gap-3 sm:w-auto">
                <Button asChild className="flex-1 sm:flex-none">
                  <Link to="/transactions?new=1">
                    <Plus />
                    {m.header.addTransaction}
                  </Link>
                </Button>
                <Button asChild variant="primary" className="flex-1 sm:flex-none">
                  <Link to="/transactions?import=new">
                    <Upload />
                    {m.header.import}
                  </Link>
                </Button>
              </div>
            )}
            {params.period === 'custom' && (
              <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:flex sm:w-auto">
                <DatePicker
                  label={m.header.fromDate}
                  invalid={Boolean(rangeProblem)}
                  value={params.from ?? ''}
                  onChange={(from) => setPeriod({ ...params, from: from || undefined })}
                  className="sm:w-[150px]"
                />
                <span className="text-body-sm text-muted">{m.header.to}</span>
                <DatePicker
                  label={m.header.toDate}
                  invalid={Boolean(rangeProblem)}
                  value={params.to ?? ''}
                  onChange={(to) => setPeriod({ ...params, to: to || undefined })}
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
      ) : (
        <div
          aria-busy={isPlaceholderData}
          className={cn(
            'flex flex-col gap-4 transition-opacity duration-200 sm:gap-6',
            isPlaceholderData && 'opacity-60',
          )}
        >
          <KpiCards data={shown} comparisonLabel={text?.comparison ?? ''} noData={noData} />

          <div className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,352px)]">
            <CashFlowOverview
              data={shown}
              periodLabel={text?.label ?? ''}
              noData={noData}
              canEdit={canEdit}
            />
            <ExpenseBreakdownPanel data={shown} periodLabel={text?.label ?? ''} noData={noData} />
          </div>

          <div className="grid gap-4 sm:gap-6 md:grid-cols-2 wide:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(320px,352px)]">
            <RecentTransactionsPanel data={shown} noData={noData} />
            {noData ? (
              <>
                <NotYetPanel
                  id="upcoming-title"
                  title={m.panels.upcoming}
                  note={m.panels.upcomingStart}
                />
                <NotYetPanel
                  id="scenario-title"
                  title={m.panels.scenario}
                  note={m.panels.scenarioStart}
                  className="md:col-span-2 wide:col-span-1"
                />
              </>
            ) : (
              <>
                <UpcomingPaymentsPanel />
                <ScenarioPreviewPanel className="md:col-span-2 wide:col-span-1" />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
