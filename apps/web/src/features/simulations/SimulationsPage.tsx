import { FlaskConical, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useScenarioResult, useScenarios } from '../../api/finance';
import { Legend, TooltipRow, TooltipTitle } from '../../components/charts/ChartTooltip';
import { LineChart } from '../../components/charts/LineChart';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel, PanelHeader } from '../../components/ui/Panel';
import { ErrorState, Skeleton } from '../../components/ui/States';
import { Tooltip } from '../../components/ui/Tooltip';
import type { ScenarioResult, ScenarioSummary } from '../../demo/types';
import { cn } from '../../lib/cn';
import { useMessages } from '../../i18n';
import { formatDate, money } from '../../lib/format';
import { simulationMessages } from './messages';
import { useHasTransactions } from '../../api/transactions';
import { EmptyChartNote } from '../../components/finance/EmptyChartNote';
import { common } from '../../i18n/common';
import { emptyScenarioResult } from '../noData';
import { useCurrentMembership } from '../auth/currentUser';

export function SimulationsPage() {
  const [params, setParams] = useSearchParams();
  // Scenarios come from the TechStore sample layer, which must not stand in for a
  // business that has recorded nothing: that business sees the same page, at zero.
  const { business, role } = useCurrentMembership();
  const gate = useHasTransactions(business.id);
  const noData = gate.hasTransactions === false;
  const sample = gate.hasTransactions === true;
  const scenarios = useScenarios({ enabled: sample });
  const selectedId = params.get('scenario') ?? scenarios.data?.[0]?.id;
  const result = useScenarioResult(selectedId, { enabled: sample });
  const m = useMessages(simulationMessages).page;
  const zero = useMemo(
    () => (noData ? emptyScenarioResult(m.noScenario) : undefined),
    [noData, m.noScenario],
  );

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow={m.eyebrow}
        title={m.title}
        description={m.description}
        actions={
          <Tooltip content={m.newHint}>
            <span tabIndex={0} className="rounded-control">
              <Button variant="primary" disabled className="pointer-events-none">
                <Plus />
                {m.new}
              </Button>
            </span>
          </Tooltip>
        }
      />

      {!noData && (gate.isError || scenarios.isError) ? (
        <Panel>
          <ErrorState
            title={m.loadError}
            onRetry={() => (gate.isError ? gate.refetch() : scenarios.refetch())}
          />
        </Panel>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <ScenarioList
            scenarios={noData ? [] : scenarios.data}
            selectedId={selectedId}
            onSelect={(id) => setParams({ scenario: id }, { replace: true })}
          />
          {result.isError ? (
            <Panel>
              <ErrorState title={m.runError} onRetry={() => result.refetch()} />
            </Panel>
          ) : (
            <ScenarioDetail
              result={zero ?? result.data}
              stale={!noData && result.isPlaceholderData}
              noData={noData}
              canEdit={role === 'OWNER'}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ScenarioList({
  scenarios,
  selectedId,
  onSelect,
}: {
  scenarios: ScenarioSummary[] | undefined;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  const m = useMessages(simulationMessages).list;
  const page = useMessages(simulationMessages).page;
  return (
    <Panel className="p-2" aria-label={m.title}>
      <p className="eyebrow px-3 pt-3 pb-2">{m.title}</p>
      {scenarios && scenarios.length === 0 ? (
        <p className="mx-1 mb-1 rounded-control bg-sunken px-4 py-6 text-center text-body-sm text-muted">
          {page.noScenarios}
        </p>
      ) : scenarios ? (
        <ul role="radiogroup" aria-label={m.choose} className="flex flex-col gap-1">
          {scenarios.map((s) => {
            const active = s.id === selectedId;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onSelect(s.id)}
                  className={cn(
                    'flex w-full cursor-pointer gap-3 rounded-control border p-3 text-left transition-colors',
                    active
                      ? 'border-chart-1/40 bg-chart-1-soft'
                      : 'border-transparent hover:bg-hover',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[9px]',
                      active ? 'bg-chart-1 text-white' : 'bg-hover text-muted',
                    )}
                  >
                    <FlaskConical className="size-4" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] leading-snug font-medium text-ink">
                      {s.name}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-muted">
                      {s.description}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="space-y-2 p-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}
    </Panel>
  );
}

function ScenarioDetail({
  result,
  stale,
  noData = false,
  canEdit = false,
}: {
  result: ScenarioResult | undefined;
  stale: boolean;
  /** No transactions: a flat plan at zero, with nothing to compare. */
  noData?: boolean;
  canEdit?: boolean;
}) {
  const t = useMessages(simulationMessages);
  const s$ = t.stats;
  const c = useMessages(common);
  if (!result) {
    return (
      <Panel className="p-6">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
        <Skeleton className="mt-8 h-[300px] w-full" />
      </Panel>
    );
  }

  const delta = result.scenarioEndCents - result.baselineEndCents;
  const projection = new Map(result.projection.map((p) => [p.date, p.balanceCents]));
  const stats = [
    {
      label: s$.currentPlan,
      hint: s$.balanceIn90,
      value: money(result.baselineEndCents, { decimals: 0 }),
      className: 'text-ink',
    },
    {
      label: s$.withScenario,
      hint: s$.balanceIn90,
      value: money(result.scenarioEndCents, { decimals: 0 }),
      className: 'text-chart-1',
    },
    {
      label: s$.difference,
      hint: delta < 0 ? s$.less : s$.more,
      value: money(delta, { decimals: 0, sign: 'always' }),
      className: noData ? 'text-ink' : delta < 0 ? 'text-negative' : 'text-positive',
    },
    {
      label: s$.lowest,
      hint: formatDate(result.scenarioLowDate, 'd MMM yyyy'),
      value: money(result.scenarioLowCents, { decimals: 0 }),
      className: 'text-ink',
    },
  ];

  return (
    <div className={cn('flex min-w-0 flex-col gap-6 transition-opacity', stale && 'opacity-60')}>
      <Panel className="p-5 sm:p-6">
        <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">
          {result.scenario.name}
        </h2>
        <p className="mt-1 text-[14px] text-ink-2">
          {noData ? c.noTransactions.title : result.scenario.description}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {result.scenario.assumptions.map((a) => (
            <Badge key={a} tone="analytic">
              {a}
            </Badge>
          ))}
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-control border border-line bg-line md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-sunken px-4 py-3.5">
              <dt className="text-[12px] text-muted">{s.label}</dt>
              <dd
                className={cn(
                  'tabular mt-1 text-[20px] font-semibold tracking-[-0.02em]',
                  s.className,
                )}
              >
                {s.value}
              </dd>
              <dd className={cn('mt-0.5 text-[11px]', noData ? 'text-muted' : 'text-faint')}>
                {noData ? c.delta.noData : s.hint}
              </dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel className="p-5 sm:p-6" aria-labelledby="scenario-chart">
        <PanelHeader
          id="scenario-chart"
          title={t.chart.title}
          description={noData ? c.noTransactions.title : t.chart.description}
          actions={
            <Legend
              items={[
                { label: s$.currentPlan, swatch: 'bg-chart-2' },
                { label: t.chart.scenario, swatch: 'bg-chart-1' },
              ]}
            />
          }
        />
        <div className="relative mt-6">
          <div className={noData ? 'opacity-40' : undefined}>
            <LineChart
              height={300}
              ariaLabel={t.chart.label(result.scenario.name)}
              series={[
                {
                  id: 'baseline',
                  label: s$.currentPlan,
                  tone: 'secondary',
                  points: result.baseline.map((p) => ({ date: p.date, value: p.balanceCents })),
                },
                {
                  id: 'scenario',
                  label: t.chart.scenario,
                  tone: 'primary',
                  area: true,
                  points: result.projection.map((p) => ({ date: p.date, value: p.balanceCents })),
                },
              ]}
              renderTooltip={(date) => {
                const base = result.baseline.find((p) => p.date === date)?.balanceCents ?? 0;
                const scenario = projection.get(date) ?? 0;
                return (
                  <>
                    <TooltipTitle>{formatDate(date, 'EEE, d MMM yyyy')}</TooltipTitle>
                    <TooltipRow
                      swatch="bg-chart-2"
                      label={s$.currentPlan}
                      value={money(base, { decimals: 0 })}
                    />
                    <TooltipRow
                      swatch="bg-chart-1"
                      label={t.chart.scenario}
                      value={money(scenario, { decimals: 0 })}
                    />
                    <div className="mt-1.5 border-t border-line pt-1.5">
                      <TooltipRow
                        label={s$.difference}
                        value={money(scenario - base, { decimals: 0, sign: 'always' })}
                        emphasis
                      />
                    </div>
                  </>
                );
              }}
            />
          </div>
          {noData && <EmptyChartNote canEdit={canEdit} ownerText={t.page.chartOwner} />}
        </div>
      </Panel>

      <Panel className="overflow-hidden" aria-labelledby="scenario-months">
        <div className="px-5 pt-5 pb-4 sm:px-6">
          <PanelHeader
            id="scenario-months"
            title={t.months.title}
            description={t.months.description}
          />
        </div>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-t border-line text-[11px] tracking-[0.08em] text-muted uppercase">
              <th scope="col" className="h-10 pr-3 pl-5 text-left font-medium sm:pl-6">
                {t.months.month}
              </th>
              <th scope="col" className="px-3 text-right font-medium">
                {s$.currentPlan}
              </th>
              <th scope="col" className="px-3 text-right font-medium">
                {t.chart.scenario}
              </th>
              <th scope="col" className="pr-5 pl-3 text-right font-medium sm:pr-6">
                {s$.difference}
              </th>
            </tr>
          </thead>
          <tbody>
            {result.months.map((m) => {
              const diff = m.scenarioNetCents - m.baselineNetCents;
              return (
                <tr key={m.key} className="tabular border-t border-line-soft">
                  <th
                    scope="row"
                    className="py-3.5 pr-3 pl-5 text-left font-normal text-ink sm:pl-6"
                  >
                    {m.label}
                  </th>
                  <td className="px-3 text-right text-ink-2">
                    {money(m.baselineNetCents, { decimals: 0, sign: 'always' })}
                  </td>
                  <td className="px-3 text-right text-ink">
                    {money(m.scenarioNetCents, { decimals: 0, sign: 'always' })}
                  </td>
                  <td
                    className={cn(
                      'pr-5 pl-3 text-right font-medium sm:pr-6',
                      diff < 0 ? 'text-negative' : diff > 0 ? 'text-positive' : 'text-muted',
                    )}
                  >
                    {money(diff, { decimals: 0, sign: 'always' })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
