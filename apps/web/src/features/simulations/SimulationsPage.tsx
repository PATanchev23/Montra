import { FlaskConical, Plus } from 'lucide-react';
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
import { formatDate, money } from '../../lib/format';

export function SimulationsPage() {
  const [params, setParams] = useSearchParams();
  const scenarios = useScenarios();
  const selectedId = params.get('scenario') ?? scenarios.data?.[0]?.id;
  const result = useScenarioResult(selectedId);

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Planning"
        title="Simulations"
        description="Test a decision before you make it. Each scenario is compared with your current plan over the next 90 days."
        actions={
          <Tooltip content="Building custom scenarios arrives with the simulations API.">
            <span tabIndex={0} className="rounded-control">
              <Button variant="primary" disabled className="pointer-events-none">
                <Plus />
                New scenario
              </Button>
            </span>
          </Tooltip>
        }
      />

      {scenarios.isError ? (
        <Panel>
          <ErrorState title="Could not load scenarios" onRetry={() => scenarios.refetch()} />
        </Panel>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <ScenarioList
            scenarios={scenarios.data}
            selectedId={selectedId}
            onSelect={(id) => setParams({ scenario: id }, { replace: true })}
          />
          {result.isError ? (
            <Panel>
              <ErrorState title="Could not run this scenario" onRetry={() => result.refetch()} />
            </Panel>
          ) : (
            <ScenarioDetail result={result.data} stale={result.isPlaceholderData} />
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
  return (
    <Panel className="p-2" aria-label="Scenarios">
      <p className="eyebrow px-3 pt-3 pb-2">Scenarios</p>
      {scenarios ? (
        <ul role="radiogroup" aria-label="Choose a scenario" className="flex flex-col gap-1">
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

function ScenarioDetail({ result, stale }: { result: ScenarioResult | undefined; stale: boolean }) {
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
      label: 'Current plan',
      hint: 'Balance in 90 days',
      value: money(result.baselineEndCents, { decimals: 0 }),
      className: 'text-ink',
    },
    {
      label: 'With scenario',
      hint: 'Balance in 90 days',
      value: money(result.scenarioEndCents, { decimals: 0 }),
      className: 'text-chart-1',
    },
    {
      label: 'Difference',
      hint: delta < 0 ? 'Less cash than planned' : 'More cash than planned',
      value: money(delta, { decimals: 0, sign: 'always' }),
      className: delta < 0 ? 'text-negative' : 'text-positive',
    },
    {
      label: 'Lowest point',
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
        <p className="mt-1 text-[14px] text-ink-2">{result.scenario.description}</p>
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
              <dd className="mt-0.5 text-[11px] text-faint">{s.hint}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel className="p-5 sm:p-6" aria-labelledby="scenario-chart">
        <PanelHeader
          id="scenario-chart"
          title="Projected balance"
          description="Next 90 days"
          actions={
            <Legend
              items={[
                { label: 'Current plan', swatch: 'bg-chart-2' },
                { label: 'Scenario', swatch: 'bg-chart-1' },
              ]}
            />
          }
        />
        <div className="mt-6">
          <LineChart
            height={300}
            ariaLabel={`Projected balance: current plan versus ${result.scenario.name}`}
            series={[
              {
                id: 'baseline',
                label: 'Current plan',
                tone: 'secondary',
                points: result.baseline.map((p) => ({ date: p.date, value: p.balanceCents })),
              },
              {
                id: 'scenario',
                label: 'Scenario',
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
                    label="Current plan"
                    value={money(base, { decimals: 0 })}
                  />
                  <TooltipRow
                    swatch="bg-chart-1"
                    label="Scenario"
                    value={money(scenario, { decimals: 0 })}
                  />
                  <div className="mt-1.5 border-t border-line pt-1.5">
                    <TooltipRow
                      label="Difference"
                      value={money(scenario - base, { decimals: 0, sign: 'always' })}
                      emphasis
                    />
                  </div>
                </>
              );
            }}
          />
        </div>
      </Panel>

      <Panel className="overflow-hidden" aria-labelledby="scenario-months">
        <div className="px-5 pt-5 pb-4 sm:px-6">
          <PanelHeader
            id="scenario-months"
            title="Month by month"
            description="Net cash flow for each projected month"
          />
        </div>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-t border-line text-[11px] tracking-[0.08em] text-muted uppercase">
              <th scope="col" className="h-10 pr-3 pl-5 text-left font-medium sm:pl-6">
                Month
              </th>
              <th scope="col" className="px-3 text-right font-medium">
                Current plan
              </th>
              <th scope="col" className="px-3 text-right font-medium">
                Scenario
              </th>
              <th scope="col" className="pr-5 pl-3 text-right font-medium sm:pr-6">
                Difference
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
