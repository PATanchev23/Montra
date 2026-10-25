import { format, parseISO } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { DEMO_TODAY, useCashFlow } from '../../api/finance';
import { CapsuleBarChart } from '../../components/charts/CapsuleBarChart';
import { Legend, TooltipRow, TooltipTitle } from '../../components/charts/ChartTooltip';
import { LineChart } from '../../components/charts/LineChart';
import { Amount } from '../../components/finance/Amount';
import { CategoryIcon } from '../../components/finance/CategoryIcon';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel, PanelHeader } from '../../components/ui/Panel';
import { ErrorState, Skeleton } from '../../components/ui/States';
import type { CashFlowData } from '../../demo/api';
import { cn } from '../../lib/cn';
import { formatDate, money, relativeDay } from '../../lib/format';

export function CashFlowPage() {
  const { data, isPending, isError, refetch } = useCashFlow();

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Analysis"
        title="Cash flow"
        description="Twelve months of history and a 90-day projection built from scheduled payments and seasonal averages."
      />

      {isError ? (
        <Panel>
          <ErrorState title="Could not load cash flow" onRetry={() => refetch()} />
        </Panel>
      ) : (
        <>
          <StatStrip stats={data?.stats} />
          <MonthlyComparison data={data} loading={isPending} />
          <BalanceProjection data={data} loading={isPending} />
          <UpcomingTable data={data} loading={isPending} />
        </>
      )}
    </div>
  );
}

function StatStrip({ stats }: { stats: CashFlowData['stats'] | undefined }) {
  const items = [
    {
      label: 'Opening balance',
      hint: format(new Date(DEMO_TODAY.getFullYear() - 1, DEMO_TODAY.getMonth(), 1), 'd MMM yyyy'),
      value: stats?.openingCents,
    },
    {
      label: 'Money in',
      hint: 'Last 12 months',
      value: stats?.incomeCents,
      className: 'text-positive',
      sign: 'always' as const,
    },
    { label: 'Money out', hint: 'Last 12 months', value: stats ? -stats.expenseCents : undefined },
    { label: 'Balance today', hint: format(DEMO_TODAY, 'd MMM yyyy'), value: stats?.closingCents },
    {
      label: 'Projected',
      hint: 'In 90 days',
      value: stats?.projectedCents,
      className: 'text-chart-1',
    },
  ];
  return (
    <Panel className="grid grid-cols-2 gap-px overflow-hidden bg-line lg:grid-cols-5">
      {items.map((item) => (
        <div
          key={item.label}
          className="min-w-0 bg-surface px-5 py-4 last:col-span-2 lg:last:col-span-1"
        >
          <p className="truncate text-[13px] text-muted">{item.label}</p>
          {item.value === undefined ? (
            <Skeleton className="mt-2 h-6 w-24" />
          ) : (
            <p
              className={cn(
                'tabular mt-1 truncate text-[20px] font-semibold tracking-[-0.02em] text-ink',
                item.className,
              )}
            >
              {money(item.value, { decimals: 0, sign: item.sign ?? 'auto' })}
            </p>
          )}
          <p className="mt-0.5 truncate text-[12px] text-faint">{item.hint}</p>
        </div>
      ))}
    </Panel>
  );
}

function MonthlyComparison({
  data,
  loading,
}: {
  data: CashFlowData | undefined;
  loading: boolean;
}) {
  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="monthly-comparison">
      <PanelHeader
        id="monthly-comparison"
        title="Income vs. expenses"
        description="Monthly totals · the last three months are projected"
        actions={
          <Legend
            items={[
              { label: 'Income', swatch: 'bg-chart-1' },
              { label: 'Expenses', swatch: 'bg-chart-2' },
              { label: 'Projected', swatch: 'border-chart-1', dashed: true },
            ]}
          />
        }
      />
      <div className="mt-6">
        {loading || !data ? (
          <Skeleton className="h-[300px] w-full" />
        ) : (
          <CapsuleBarChart
            layout="grouped"
            height={300}
            ariaLabel="Monthly income and expenses, with three projected months"
            categories={data.months.map((m) => ({
              key: m.key,
              label: m.label,
              projected: m.projected,
            }))}
            series={[
              {
                id: 'income',
                label: 'Income',
                tone: 'primary',
                values: data.months.map((m) => m.incomeCents),
              },
              {
                id: 'expenses',
                label: 'Expenses',
                tone: 'secondary',
                values: data.months.map((m) => m.expenseCents),
              },
            ]}
            renderTooltip={(i) => {
              const m = data.months[i]!;
              return (
                <>
                  <TooltipTitle>
                    {format(parseISO(`${m.key}-01`), 'MMMM yyyy')}
                    {m.projected && <span className="font-normal text-chart-1"> · projected</span>}
                  </TooltipTitle>
                  <TooltipRow
                    swatch="bg-chart-1"
                    label="Income"
                    value={money(m.incomeCents, { decimals: 0 })}
                  />
                  <TooltipRow
                    swatch="bg-chart-2"
                    label="Expenses"
                    value={money(m.expenseCents, { decimals: 0 })}
                  />
                  <div className="mt-1.5 border-t border-line pt-1.5">
                    <TooltipRow
                      label="Net"
                      value={money(m.netCents, { decimals: 0, sign: 'always' })}
                      emphasis
                    />
                  </div>
                </>
              );
            }}
          />
        )}
      </div>
    </Panel>
  );
}

function BalanceProjection({
  data,
  loading,
}: {
  data: CashFlowData | undefined;
  loading: boolean;
}) {
  const todayIso = format(DEMO_TODAY, 'yyyy-MM-dd');
  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="balance-projection">
      <PanelHeader
        id="balance-projection"
        title="Balance & projection"
        description="Daily balance for the last five months, then the expected path with its likely range"
        actions={
          <Legend
            items={[
              { label: 'Balance', swatch: 'bg-chart-1' },
              { label: 'Projection', swatch: 'border-chart-1', dashed: true },
              { label: 'Likely range', swatch: 'bg-chart-1/25' },
            ]}
          />
        }
      />
      <div className="mt-6">
        {loading || !data ? (
          <Skeleton className="h-[280px] w-full" />
        ) : (
          <LineChart
            height={280}
            ariaLabel="Daily cash balance with a 90-day projection"
            series={[
              {
                id: 'balance',
                label: 'Balance',
                tone: 'primary',
                area: true,
                points: data.balance.map((p) => ({
                  date: p.date,
                  value: p.balanceCents,
                  projected: p.projected,
                })),
              },
            ]}
            band={data.balance
              .filter((p) => p.projected && p.lowCents !== undefined)
              .map((p) => ({ date: p.date, low: p.lowCents!, high: p.highCents! }))}
            markers={[{ date: todayIso, label: 'Today' }]}
            threshold={{
              value: data.thresholdCents,
              label: `Safety buffer ${money(data.thresholdCents, { decimals: 0 })}`,
            }}
            renderTooltip={(date) => {
              const p = data.balance.find((b) => b.date === date)!;
              return (
                <>
                  <TooltipTitle>
                    {formatDate(date, 'EEE, d MMM yyyy')}
                    {p.projected && <span className="font-normal text-chart-1"> · projected</span>}
                  </TooltipTitle>
                  <TooltipRow
                    swatch="bg-chart-1"
                    label="Balance"
                    value={money(p.balanceCents, { decimals: 0 })}
                    emphasis
                  />
                  {p.projected && p.lowCents !== undefined && (
                    <TooltipRow
                      label="Likely range"
                      value={`${money(p.lowCents, { decimals: 0 })} – ${money(p.highCents!, { decimals: 0 })}`}
                    />
                  )}
                </>
              );
            }}
          />
        )}
      </div>
      {data && (
        <dl className="mt-6 grid gap-4 border-t border-line pt-5 text-[13px] sm:grid-cols-3">
          <div>
            <dt className="text-muted">Lowest projected balance</dt>
            <dd className="tabular mt-0.5 text-[15px] font-medium text-ink">
              {money(data.stats.lowestCents, { decimals: 0 })}{' '}
              <span className="font-normal text-muted">
                on {formatDate(data.stats.lowestDate, 'd MMM')}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-muted">Headroom above buffer</dt>
            <dd className="tabular mt-0.5 text-[15px] font-medium text-positive">
              {money(data.stats.lowestCents - data.thresholdCents, { decimals: 0 })}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Change over 90 days</dt>
            <dd className="tabular mt-0.5 text-[15px] font-medium text-ink">
              {money(data.stats.projectedCents - data.stats.closingCents, {
                decimals: 0,
                sign: 'always',
              })}
            </dd>
          </div>
        </dl>
      )}
    </Panel>
  );
}

const COLLAPSED_ROWS = 10;

function UpcomingTable({ data, loading }: { data: CashFlowData | undefined; loading: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const rows = data ? (expanded ? data.upcoming : data.upcoming.slice(0, COLLAPSED_ROWS)) : [];
  const inflow =
    data?.upcoming.filter((u) => u.type === 'income').reduce((s, u) => s + u.amountCents, 0) ?? 0;
  const outflow =
    data?.upcoming.filter((u) => u.type === 'expense').reduce((s, u) => s + u.amountCents, 0) ?? 0;

  return (
    <Panel id="upcoming" className="scroll-mt-6 overflow-hidden" aria-labelledby="upcoming-heading">
      <div className="px-5 pt-5 pb-4 sm:px-6">
        <PanelHeader
          id="upcoming-heading"
          title="Next 30 days"
          description="Scheduled payments, expected payouts and the running balance after each"
          actions={
            data && (
              <div className="tabular flex gap-4 text-[13px]">
                <span className="text-muted">
                  In{' '}
                  <span className="font-medium text-positive">
                    {money(inflow, { decimals: 0 })}
                  </span>
                </span>
                <span className="text-muted">
                  Out{' '}
                  <span className="font-medium text-ink">{money(outflow, { decimals: 0 })}</span>
                </span>
              </div>
            )
          }
        />
      </div>
      {loading || !data ? (
        <div className="space-y-3 px-6 pb-6">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-t border-line text-left text-[11px] tracking-[0.08em] text-muted uppercase">
                  <th scope="col" className="h-10 pr-3 pl-5 font-medium sm:pl-6">
                    Due
                  </th>
                  <th scope="col" className="px-3 font-medium">
                    Item
                  </th>
                  <th scope="col" className="hidden px-3 font-medium md:table-cell">
                    Basis
                  </th>
                  <th scope="col" className="px-3 text-right font-medium">
                    Amount
                  </th>
                  <th
                    scope="col"
                    className="hidden pr-5 pl-3 text-right font-medium sm:table-cell sm:pr-6"
                  >
                    Balance after
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="border-t border-line-soft hover:bg-hover/60">
                    <td className="tabular py-3 pr-3 pl-5 whitespace-nowrap text-ink-2 sm:pl-6">
                      {relativeDay(u.dueDate, DEMO_TODAY, 'EEE d MMM')}
                    </td>
                    <td className="w-full max-w-0 px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <CategoryIcon categoryId={u.categoryId} size="sm" />
                        <div className="min-w-0 leading-tight">
                          <p className="truncate text-[14px] text-ink">{u.description}</p>
                          <p className="mt-1 truncate text-[12px] text-muted">{u.detail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-3 md:table-cell">
                      {u.certainty === 'scheduled' ? (
                        <Badge tone="accent">Scheduled</Badge>
                      ) : (
                        <Badge>Estimated</Badge>
                      )}
                    </td>
                    <td className="px-3 text-right text-[14px]">
                      <Amount cents={u.amountCents} type={u.type} quietExpense />
                    </td>
                    <td className="tabular hidden pr-5 pl-3 text-right text-muted sm:table-cell sm:pr-6">
                      {money(u.balanceAfterCents, { decimals: 0 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.upcoming.length > COLLAPSED_ROWS && (
            <div className="border-t border-line px-5 py-3 sm:px-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded((e) => !e)}
                aria-expanded={expanded}
              >
                <ChevronDown className={cn('transition-transform', expanded && 'rotate-180')} />
                {expanded ? 'Show fewer' : `Show all ${data.upcoming.length}`}
              </Button>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
