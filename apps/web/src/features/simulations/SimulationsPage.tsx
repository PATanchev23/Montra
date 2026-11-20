import {
  scenarioQuerySchema,
  todayIn,
  type ScenarioPresetId,
  type ScenarioRule,
  type SimulationResponse,
} from '@montra/shared';
import { FlaskConical, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ruleQuery, useScenarioPresets, useSimulation } from '../../api/finance';
import { Legend, TooltipRow, TooltipTitle } from '../../components/charts/ChartTooltip';
import { LineChart } from '../../components/charts/LineChart';
import { EmptyChartNote } from '../../components/finance/EmptyChartNote';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel, PanelHeader } from '../../components/ui/Panel';
import { ErrorState, Skeleton } from '../../components/ui/States';
import { useMessages } from '../../i18n';
import { common } from '../../i18n/common';
import { cn } from '../../lib/cn';
import { formatDate, money } from '../../lib/format';
import { useCurrentMembership } from '../auth/currentUser';
import { describeScenario, type ScenarioId, type ScenarioText } from './describe';
import { simulationMessages } from './messages';
import { ScenarioBuilderSheet } from './ScenarioBuilderSheet';

/** A scenario the user built, read back from the address (so it can be shared and reloaded). */
function customRule(params: URLSearchParams): ScenarioRule | undefined {
  if (params.get('scenario') !== 'custom') return undefined;
  const fields = Object.fromEntries([...params].filter(([key]) => key !== 'scenario'));
  const parsed = scenarioQuerySchema.safeParse(fields);
  return parsed.success ? parsed.data : {};
}

export function SimulationsPage() {
  const [params, setParams] = useSearchParams();
  const { business } = useCurrentMembership();
  const presets = useScenarioPresets(business.id);
  const [building, setBuilding] = useState(false);
  const m = useMessages(simulationMessages).page;

  const custom = useMemo(() => customRule(params), [params]);
  const list = presets.data?.presets;
  const suggested = presets.data?.suggested;
  const requested = params.get('scenario');
  // A suggestion run from "New scenario" joins the list while it is open.
  const picked = list?.some((p) => p.id === requested)
    ? undefined
    : suggested?.find((p) => p.id === requested);
  const preset = list?.find((p) => p.id === requested) ?? picked ?? list?.[0];
  const noData = list !== undefined && list.length === 0 && !custom;
  const selectedId: ScenarioId | undefined = custom ? 'custom' : preset?.id;
  // Without transactions there is nothing to change: run the plain plan, flat.
  const rule = custom ?? preset?.rule ?? (noData ? {} : undefined);
  const result = useSimulation(business.id, rule);

  const context = {
    currency: business.currency,
    today: result.data?.today ?? todayIn(business.timezone),
  };
  const text: ScenarioText | undefined = noData
    ? { name: m.noScenario, description: '', assumptions: [] }
    : selectedId && rule
      ? describeScenario(
          { id: selectedId, rule, basis: custom ? undefined : preset?.basis },
          context,
        )
      : undefined;

  const run = (next: ScenarioRule) => {
    setParams({ scenario: 'custom', ...Object.fromEntries(new URLSearchParams(ruleQuery(next))) });
    setBuilding(false);
  };
  const runSuggestion = (id: ScenarioPresetId) => {
    setParams({ scenario: id });
    setBuilding(false);
  };

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow={m.eyebrow}
        title={m.title}
        description={m.description}
        actions={
          <Button variant="primary" onClick={() => setBuilding(true)}>
            <Plus />
            {m.new}
          </Button>
        }
      />

      {presets.isError ? (
        <Panel>
          <ErrorState title={m.loadError} onRetry={() => presets.refetch()} />
        </Panel>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <ScenarioList
            items={
              list &&
              [
                ...(custom ? [{ id: 'custom' as const, rule: custom }] : []),
                ...(picked ? [picked] : []),
                ...list,
              ].map((p) => ({ id: p.id, text: describeScenario(p, context) }))
            }
            selectedId={selectedId}
            onSelect={(id) => setParams({ scenario: id }, { replace: true })}
            onSelectCustom={() => setBuilding(true)}
          />
          {result.isError ? (
            <Panel>
              <ErrorState title={m.runError} onRetry={() => result.refetch()} />
            </Panel>
          ) : (
            <ScenarioDetail
              result={result.data}
              text={text}
              stale={result.isPlaceholderData}
              noData={noData}
            />
          )}
        </div>
      )}

      {building && (
        <ScenarioBuilderSheet
          businessId={business.id}
          currency={business.currency}
          initial={custom ?? {}}
          suggestions={(suggested ?? []).map((p) => ({
            ...p,
            text: describeScenario(p, context),
          }))}
          onRun={run}
          onRunSuggestion={runSuggestion}
          onOpenChange={setBuilding}
        />
      )}
    </div>
  );
}

function ScenarioList({
  items,
  selectedId,
  onSelect,
  onSelectCustom,
}: {
  items: { id: ScenarioId; text: ScenarioText }[] | undefined;
  selectedId: ScenarioId | undefined;
  onSelect: (id: ScenarioId) => void;
  onSelectCustom: () => void;
}) {
  const m = useMessages(simulationMessages).list;
  const page = useMessages(simulationMessages).page;
  return (
    <Panel className="p-2" aria-label={m.title}>
      <p className="eyebrow px-3 pt-3 pb-2">{m.title}</p>
      {items && items.length === 0 ? (
        <div className="mx-1 mb-1 rounded-control bg-sunken px-4 py-6 text-center">
          <p className="text-body-sm text-ink">{page.noScenarios}</p>
          <p className="mt-1 text-[12px] text-muted">{page.noScenariosHint}</p>
        </div>
      ) : items ? (
        <ul role="radiogroup" aria-label={m.choose} className="flex flex-col gap-1">
          {items.map((s) => {
            const active = s.id === selectedId;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => (s.id === 'custom' && active ? onSelectCustom() : onSelect(s.id))}
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
                      {s.text.name}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-muted">
                      {s.text.description}
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
  text,
  stale,
  noData,
}: {
  result: SimulationResponse | undefined;
  text: ScenarioText | undefined;
  stale: boolean;
  /** No transactions: a flat plan, with nothing to compare. */
  noData: boolean;
}) {
  const t = useMessages(simulationMessages);
  const s$ = t.stats;
  const c = useMessages(common);
  const { role } = useCurrentMembership();
  if (!result || !text) {
    return (
      <Panel className="p-6">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
        <Skeleton className="mt-8 h-[300px] w-full" />
      </Panel>
    );
  }

  const fmt = (cents: number, sign: 'auto' | 'always' = 'auto') =>
    money(cents, { decimals: 0, sign, currency: result.currency });
  const delta = result.scenarioEndCents - result.baselineEndCents;
  const projection = new Map(result.projection.map((p) => [p.date, p.balanceCents]));
  const stats = [
    {
      label: s$.currentPlan,
      hint: s$.balanceIn90,
      value: fmt(result.baselineEndCents),
      className: 'text-ink',
    },
    {
      label: s$.withScenario,
      hint: s$.balanceIn90,
      value: fmt(result.scenarioEndCents),
      className: 'text-chart-1',
    },
    {
      label: s$.difference,
      hint: delta < 0 ? s$.less : s$.more,
      value: fmt(delta, 'always'),
      className: noData ? 'text-ink' : delta < 0 ? 'text-negative' : 'text-positive',
    },
    {
      label: s$.lowest,
      hint: formatDate(result.scenarioLowDate, 'd MMM yyyy'),
      value: fmt(result.scenarioLowCents),
      className: 'text-ink',
    },
  ];

  return (
    <div className={cn('flex min-w-0 flex-col gap-6 transition-opacity', stale && 'opacity-60')}>
      <Panel className="p-5 sm:p-6">
        <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">{text.name}</h2>
        <p className="mt-1 text-[14px] text-ink-2">
          {noData ? t.page.noScenariosHint : text.description}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {text.assumptions.map((a) => (
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
          description={noData ? t.page.noScenario : t.chart.description}
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
              ariaLabel={t.chart.label(text.name)}
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
                    <TooltipRow swatch="bg-chart-2" label={s$.currentPlan} value={fmt(base)} />
                    <TooltipRow
                      swatch="bg-chart-1"
                      label={t.chart.scenario}
                      value={fmt(scenario)}
                    />
                    <div className="mt-1.5 border-t border-line pt-1.5">
                      <TooltipRow
                        label={s$.difference}
                        value={fmt(scenario - base, 'always')}
                        emphasis
                      />
                    </div>
                  </>
                );
              }}
            />
          </div>
          {noData && <EmptyChartNote canEdit={role === 'OWNER'} ownerText={t.page.chartOwner} />}
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
                <tr key={m.month} className="tabular border-t border-line-soft">
                  <th
                    scope="row"
                    className="py-3.5 pr-3 pl-5 text-left font-normal text-ink sm:pl-6"
                  >
                    {formatDate(`${m.month}-01`, 'LLLL yyyy')}
                  </th>
                  <td className="px-3 text-right text-ink-2">
                    {fmt(m.baselineNetCents, 'always')}
                  </td>
                  <td className="px-3 text-right text-ink">{fmt(m.scenarioNetCents, 'always')}</td>
                  <td
                    className={cn(
                      'pr-5 pl-3 text-right font-medium sm:pr-6',
                      diff < 0 ? 'text-negative' : diff > 0 ? 'text-positive' : 'text-muted',
                    )}
                  >
                    {fmt(diff, 'always')}
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
