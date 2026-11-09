import {
  TRANSACTION_DATE_MAX,
  TRANSACTION_DATE_MIN,
  todayIn,
  type DashboardPeriod,
} from '@montra/shared';
import { CalendarRange, Plus, ReceiptText } from 'lucide-react';
import { Link } from 'react-router';
import { errorMessage } from '../../api/client';
import { useDashboardSummary } from '../../api/dashboard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel } from '../../components/ui/Panel';
import { Select } from '../../components/ui/Select';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { cn } from '../../lib/cn';
import { greeting } from '../../lib/format';
import { useUiStore } from '../../stores/ui';
import { firstName } from '../auth/access';
import { useCurrentMembership, useSignedInUser } from '../auth/currentUser';
import { CashFlowOverview } from './CashFlowOverview';
import { ExpenseBreakdownPanel, RecentTransactionsPanel } from './DashboardPanels';
import { KpiCards } from './KpiCards';
import { customRangeProblem, describePeriod, periodOptions, previewRange } from './period';

const plural = (n: number, word: string) =>
  `${n.toLocaleString('en')} ${word}${n === 1 ? '' : 's'}`;

export function DashboardPage() {
  const { user } = useSignedInUser();
  const { business, role } = useCurrentMembership();
  const params = useUiStore((s) => s.period);
  const setPeriod = useUiStore((s) => s.setPeriod);

  const rangeProblem = customRangeProblem(params);
  const { data, isError, error, isPlaceholderData, refetch } = useDashboardSummary(
    business.id,
    params,
    { enabled: !rangeProblem },
  );
  const shown = rangeProblem ? undefined : data;
  const text = shown && describePeriod(shown.period.period, shown.period);

  function choosePeriod(period: DashboardPeriod) {
    if (period !== 'custom') return setPeriod({ period });
    // A custom range starts from the dates on screen, ready to adjust.
    const current = previewRange(params, todayIn(business.timezone));
    setPeriod({ period, from: current?.from, to: current?.to });
  }

  const noTransactions = shown !== undefined && shown.recent.length === 0;

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Dashboard"
        title={`${greeting()}, ${firstName(user.name)}`}
        description={
          text ? (
            <>
              Here’s how {business.name} performed {text.phrase}
              <span className="text-muted">
                {' '}
                · {plural(shown.overview.transactionCount, 'transaction')}
              </span>
            </>
          ) : (
            <>Here’s how {business.name} is doing.</>
          )
        }
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {params.period === 'custom' && (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  aria-label="From date"
                  aria-invalid={rangeProblem ? true : undefined}
                  min={TRANSACTION_DATE_MIN}
                  max={TRANSACTION_DATE_MAX}
                  value={params.from ?? ''}
                  onChange={(e) => setPeriod({ ...params, from: e.target.value || undefined })}
                  className="w-[150px]"
                />
                <span className="text-[13px] text-muted">to</span>
                <Input
                  type="date"
                  aria-label="To date"
                  aria-invalid={rangeProblem ? true : undefined}
                  min={TRANSACTION_DATE_MIN}
                  max={TRANSACTION_DATE_MAX}
                  value={params.to ?? ''}
                  onChange={(e) => setPeriod({ ...params, to: e.target.value || undefined })}
                  className="w-[150px]"
                />
              </div>
            )}
            <Select<DashboardPeriod>
              label="Reporting period"
              value={params.period}
              onChange={choosePeriod}
              options={periodOptions}
              className="w-[156px]"
            />
          </div>
        }
      />

      {rangeProblem ? (
        <Panel>
          <EmptyState icon={CalendarRange} title="Check the date range" body={rangeProblem} />
        </Panel>
      ) : isError ? (
        <Panel>
          <ErrorState
            title={errorMessage(error, 'Could not load the dashboard')}
            onRetry={() => refetch()}
          />
        </Panel>
      ) : noTransactions ? (
        <Panel>
          <EmptyState
            icon={ReceiptText}
            title="No transactions yet"
            body={
              role === 'OWNER'
                ? 'Your dashboard fills in as soon as you record a payment or import your history.'
                : 'The dashboard fills in once the business owner records transactions.'
            }
            action={
              role === 'OWNER' && (
                <Button asChild variant="primary">
                  <Link to="/transactions">
                    <Plus />
                    Add or import transactions
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
            'grid items-start gap-6 transition-opacity duration-200 xl:grid-cols-[minmax(0,1fr)_minmax(300px,348px)]',
            isPlaceholderData && 'opacity-60',
          )}
        >
          <div className="flex min-w-0 flex-col gap-6">
            <KpiCards data={shown} comparisonLabel={text?.comparison ?? ''} />
            <CashFlowOverview data={shown} periodLabel={text?.label ?? ''} />
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-1">
            <ExpenseBreakdownPanel data={shown} periodLabel={text?.label ?? ''} />
            <RecentTransactionsPanel data={shown} />
          </div>
        </div>
      )}
    </div>
  );
}
