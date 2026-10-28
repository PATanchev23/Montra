import { business, useDashboard } from '../../api/finance';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel } from '../../components/ui/Panel';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { ErrorState } from '../../components/ui/States';
import type { PeriodUnit } from '../../demo/types';
import { greeting } from '../../lib/format';
import { useUiStore } from '../../stores/ui';
import { firstName } from '../auth/access';
import { useSignedInUser } from '../auth/currentUser';
import { CashFlowOverview } from './CashFlowOverview';
import {
  ExpenseBreakdownPanel,
  InsightPanel,
  RecentTransactionsPanel,
  ScenarioPreviewPanel,
  UpcomingPaymentsPanel,
} from './DashboardPanels';
import { KpiCards } from './KpiCards';

const units: { value: PeriodUnit; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
];

const performedIn = (unit: PeriodUnit, offset: number, label: string) =>
  offset === 0 ? `this ${unit}` : `in ${label}`;

export function DashboardPage() {
  const period = useUiStore((s) => s.period);
  const setPeriodUnit = useUiStore((s) => s.setPeriodUnit);
  const { data, isError, refetch } = useDashboard(period);
  const { user } = useSignedInUser();

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Dashboard"
        title={`${greeting()}, ${firstName(user.name)}`}
        description={
          <>
            Here’s how {business.name} performed{' '}
            {data
              ? performedIn(period.unit, period.offset, data.period.label)
              : `this ${period.unit}`}
            .
          </>
        }
        actions={
          <SegmentedControl
            label="Reporting period"
            value={period.unit}
            onChange={setPeriodUnit}
            options={units}
          />
        }
      />

      {isError ? (
        <Panel>
          <ErrorState title="Could not load the dashboard" onRetry={() => refetch()} />
        </Panel>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,348px)]">
          <div className="flex min-w-0 flex-col gap-6">
            <KpiCards kpis={data?.kpis} comparisonLabel={data?.period.comparisonLabel ?? ''} />
            <CashFlowOverview />
            <div className="grid gap-6 lg:grid-cols-2">
              <RecentTransactionsPanel items={data?.recent} />
              <UpcomingPaymentsPanel items={data?.upcoming} />
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-1">
            <InsightPanel key={`${period.unit}-${period.offset}`} insights={data?.insights} />
            <ExpenseBreakdownPanel
              breakdown={data?.expenseBreakdown}
              periodLabel={data?.period.label ?? ''}
            />
            <div className="md:col-span-2 xl:col-span-1">
              <ScenarioPreviewPanel preview={data?.scenarioPreview} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
