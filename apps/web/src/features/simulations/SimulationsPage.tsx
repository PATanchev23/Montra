import {
  scenarioQuerySchema,
  scenarioRuleSchema,
  todayIn,
  type ScenarioPresetId,
  type ScenarioRule,
  type SimulationResponse,
} from '@montra/shared';
import { Equal, FlaskConical, Minus, Plus, X } from 'lucide-react';
import { AnimatePresence, motion, useIsPresent } from 'motion/react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import {
  ruleQuery,
  usePrefetchSimulation,
  useScenarioPresets,
  useSimulation,
} from '../../api/finance';
import { Legend, TooltipRow, TooltipTitle } from '../../components/charts/ChartTooltip';
import { LineChart, type LineCallout } from '../../components/charts/LineChart';
import { EmptyChartNote } from '../../components/finance/EmptyChartNote';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel, PanelHeader } from '../../components/ui/Panel';
import { RollingText } from '../../components/ui/RollingText';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States';
import { useMessages } from '../../i18n';
import { common } from '../../i18n/common';
import { cn } from '../../lib/cn';
import { formatDate, money } from '../../lib/format';
import { useOpenCount, useStayMounted } from '../../lib/presence';
import { NO_SCENARIO_CHOICES, useUiStore } from '../../stores/ui';
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

/** The address that shows a scenario on the page. */
const scenarioParams = (id: ScenarioId, custom: ScenarioRule | undefined) =>
  id === 'custom'
    ? { scenario: 'custom', ...Object.fromEntries(new URLSearchParams(ruleQuery(custom ?? {}))) }
    : { scenario: id };

/**
 * Simulations: a rail with the scenarios to choose from and what the chosen
 * one does to the balance in 90 days, read as a statement; beside it the
 * scenario's story, the balance against the plan with the gap between them
 * shaded, and the next three months side by side. Under 1280px the rail's
 * two panels sit above the story, side by side from 768px.
 */
export function SimulationsPage() {
  const [params, setParams] = useSearchParams();
  const { business } = useCurrentMembership();
  const presets = useScenarioPresets(business.id);
  const [building, setBuilding] = useState(false);
  const builderMounted = useStayMounted(building);
  const builderKey = useOpenCount(building);
  const m = useMessages(simulationMessages).page;
  const choices = useUiStore((s) => s.scenarios[business.id]) ?? NO_SCENARIO_CHOICES;
  const addScenario = useUiStore((s) => s.addScenario);
  const removeScenario = useUiStore((s) => s.removeScenario);
  const saveCustomScenario = useUiStore((s) => s.saveCustomScenario);

  // The user's own scenario: the one in the address, else the last one built.
  const linked = useMemo(() => customRule(params), [params]);
  const saved = useMemo(() => {
    const parsed = scenarioRuleSchema.safeParse(choices.custom);
    return choices.custom && parsed.success ? parsed.data : undefined;
  }, [choices.custom]);
  const custom = linked ?? saved;
  // One opened from a link stays on the list while another is viewed.
  useEffect(() => {
    if (linked && (!saved || ruleQuery(linked) !== ruleQuery(saved))) {
      saveCustomScenario(business.id, linked);
    }
  }, [linked, saved, business.id, saveCustomScenario]);

  const list = presets.data?.presets;
  const suggested = presets.data?.suggested;
  const offeredById = (id: ScenarioPresetId) =>
    suggested?.find((p) => p.id === id) ?? list?.find((p) => p.id === id);
  // Suggestions the user added come first, newest on top, then the ready-made
  // ones they kept. An added one the figures no longer support drops away.
  const shown = list && [
    ...choices.added.flatMap((id) => offeredById(id) ?? []),
    ...list.filter((p) => !choices.removed.includes(p.id) && !choices.added.includes(p.id)),
  ];
  // "New scenario" offers whatever is not on the list: the next best, then any taken off it.
  const offered = [...(suggested ?? []), ...(list ?? [])].filter(
    (p) => !shown?.some((s) => s.id === p.id),
  );

  const requested = params.get('scenario');
  const viewingCustom = requested === 'custom' && custom !== undefined;
  const preset = viewingCustom ? undefined : (shown?.find((p) => p.id === requested) ?? shown?.[0]);
  // With nothing else on the list, the user's own is shown.
  const customSelected =
    custom !== undefined && (viewingCustom || (shown !== undefined && !preset));
  const noData = list !== undefined && list.length === 0 && !custom;
  // Everything was taken off the list: nothing to compare until one is added.
  const cleared = shown !== undefined && !noData && !preset && !customSelected;
  const selectedId: ScenarioId | undefined = customSelected ? 'custom' : preset?.id;
  // Without transactions there is nothing to change: run the plain plan, flat.
  const rule = customSelected ? custom : (preset?.rule ?? (noData ? {} : undefined));
  const result = useSimulation(business.id, rule);

  const context = {
    currency: business.currency,
    today: result.data?.today ?? todayIn(business.timezone),
  };
  const text: ScenarioText | undefined = noData
    ? { name: m.noScenario, description: '', assumptions: [] }
    : selectedId && rule
      ? describeScenario(
          { id: selectedId, rule, basis: customSelected ? undefined : preset?.basis },
          context,
        )
      : undefined;

  const items =
    shown &&
    [...(custom ? [{ id: 'custom' as const, rule: custom }] : []), ...shown].map((p) => ({
      id: p.id,
      rule: p.rule,
      text: describeScenario(p, context),
    }));
  const prefetch = usePrefetchSimulation(business.id);

  const run = (next: ScenarioRule) => {
    saveCustomScenario(business.id, next);
    setParams(scenarioParams('custom', next));
    setBuilding(false);
  };
  const runSuggestion = (id: ScenarioPresetId) => {
    addScenario(business.id, id);
    setParams({ scenario: id });
    setBuilding(false);
  };
  const remove = (id: ScenarioId) => {
    removeScenario(business.id, id);
    if (id !== selectedId) return;
    const next = items?.find((item) => item.id !== id);
    setParams(next ? scenarioParams(next.id, custom) : {}, { replace: true });
  };

  const showResult = !cleared && !result.isError;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
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
        <div className="grid gap-6 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <div
            className={cn(
              'grid min-w-0 content-start gap-6 xl:flex xl:flex-col',
              showResult && 'md:grid-cols-2',
            )}
          >
            <ScenarioList
              items={items}
              emptyHint={cleared ? m.listClearedHint : m.noScenariosHint}
              selectedId={selectedId}
              onSelect={(id) => setParams(scenarioParams(id, custom), { replace: true })}
              onPrefetch={prefetch}
              onSelectCustom={() => setBuilding(true)}
              onRemove={remove}
            />
            {showResult && (
              <ScenarioResult
                result={result.data}
                text={text}
                stale={result.isPlaceholderData}
                noData={noData}
              />
            )}
          </div>
          {/* Stretches with the rail, so both columns end on one line. */}
          <div className="flex min-w-0 flex-col">
            {cleared ? (
              <Panel>
                <EmptyState
                  icon={FlaskConical}
                  title={m.listCleared}
                  body={m.listClearedHint}
                  action={
                    <Button onClick={() => setBuilding(true)}>
                      <Plus />
                      {m.new}
                    </Button>
                  }
                />
              </Panel>
            ) : result.isError ? (
              <Panel>
                <ErrorState title={m.runError} onRetry={() => result.refetch()} />
              </Panel>
            ) : (
              <ScenarioDetail
                result={result.data}
                text={text}
                scenarioKey={noData ? 'none' : `${selectedId}?${ruleQuery(rule ?? {})}`}
                stale={result.isPlaceholderData}
                noData={noData}
              />
            )}
          </div>
        </div>
      )}

      {builderMounted && (
        <ScenarioBuilderSheet
          key={builderKey}
          open={building}
          businessId={business.id}
          currency={business.currency}
          initial={(customSelected && custom) || {}}
          suggestions={offered.map((p) => ({
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
  emptyHint,
  selectedId,
  onSelect,
  onPrefetch,
  onSelectCustom,
  onRemove,
}: {
  items: { id: ScenarioId; rule: ScenarioRule; text: ScenarioText }[] | undefined;
  emptyHint: string;
  selectedId: ScenarioId | undefined;
  onSelect: (id: ScenarioId) => void;
  /** Starts running a scenario the user is about to choose. */
  onPrefetch: (rule: ScenarioRule) => void;
  onSelectCustom: () => void;
  onRemove: (id: ScenarioId) => void;
}) {
  const m = useMessages(simulationMessages).list;
  const page = useMessages(simulationMessages).page;
  return (
    <Panel className="p-3" aria-labelledby="scenario-list">
      <PanelHeader id="scenario-list" title={m.title} className="min-h-0 px-3 pt-2 pb-1" />
      {items && items.length === 0 ? (
        <div className="m-1 mt-2 rounded-control bg-sunken px-4 py-6 text-center">
          <p className="text-body-sm text-ink">{page.noScenarios}</p>
          <p className="mt-1 text-caption text-muted">{emptyHint}</p>
        </div>
      ) : items ? (
        <ul role="radiogroup" aria-label={m.choose} className="mt-1 flex flex-col gap-0.5">
          {items.map((s) => {
            const active = s.id === selectedId;
            return (
              <li key={s.id} className="group relative">
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => (s.id === 'custom' && active ? onSelectCustom() : onSelect(s.id))}
                  onPointerEnter={() => onPrefetch(s.rule)}
                  onFocus={() => onPrefetch(s.rule)}
                  className={cn(
                    'relative flex w-full cursor-pointer items-start gap-3 rounded-control p-3 pr-10 text-left transition-colors',
                    !active && 'hover:bg-hover/60',
                  )}
                >
                  {/* The highlight glides from the scenario left to the one chosen. */}
                  {active && (
                    <motion.span
                      aria-hidden
                      layoutId="scenario-selection"
                      className="absolute inset-0 rounded-control bg-hover"
                      transition={{ type: 'spring', stiffness: 520, damping: 44 }}
                    />
                  )}
                  {/* A radio mark: a ring, filled with ink for the scenario shown. */}
                  <span
                    aria-hidden
                    className={cn(
                      'relative mt-[3px] grid size-4 shrink-0 place-items-center rounded-full border-[1.5px] transition-colors duration-200',
                      active ? 'border-chart-1' : 'border-control',
                    )}
                  >
                    <span
                      className={cn(
                        'size-2 rounded-full bg-chart-1 transition-transform duration-200 ease-out',
                        active ? 'scale-100' : 'scale-0',
                      )}
                    />
                  </span>
                  <span className="relative min-w-0">
                    <span className="block text-body leading-snug font-medium text-ink">
                      {s.text.name}
                    </span>
                    <span className="mt-0.5 line-clamp-2 text-caption text-muted md:line-clamp-none xl:line-clamp-2">
                      {s.text.description}
                    </span>
                  </span>
                </button>
                {/* Shown on hover or focus where there is a pointer; always on touch screens. */}
                <IconButton
                  label={m.remove(s.text.name)}
                  size="sm"
                  onClick={() => onRemove(s.id)}
                  className="absolute top-2 right-2 size-7 text-muted opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100 [&_svg]:size-4"
                >
                  <X strokeWidth={1.75} />
                </IconButton>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="space-y-2 p-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      )}
    </Panel>
  );
}

const operatorIcons = { plus: Plus, minus: Minus, equals: Equal } as const;

/** The sign before a figure of the result, as on the Cash flow statement. */
function OperatorMark({ kind }: { kind?: keyof typeof operatorIcons | 'low' }) {
  if (!kind) return <span aria-hidden className="size-7 shrink-0" />;
  if (kind === 'low') {
    // The ring that marks the lowest point on the chart.
    return (
      <span aria-hidden className="grid size-7 shrink-0 place-items-center">
        <span className="size-2.5 rounded-full border-2 border-chart-1" />
      </span>
    );
  }
  const Icon = operatorIcons[kind];
  return (
    <span
      aria-hidden
      className="grid size-7 shrink-0 place-items-center rounded-full bg-sunken text-ink-2"
    >
      <Icon className="size-3.5" strokeWidth={2.25} />
    </span>
  );
}

/** One line of the result: a mark, its label with a quiet line beneath, and the figure at the right. */
function Line({
  mark,
  label,
  hint,
  children,
  className,
}: {
  mark: ReactNode;
  label: string;
  hint: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-4 py-4', className)}>
      {mark}
      <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4">
        <dt className="truncate text-body-sm text-ink-2">{label}</dt>
        <dd className="col-start-2 row-span-2 row-start-1 text-right">{children}</dd>
        <dd className="truncate text-caption text-muted">{hint}</dd>
      </div>
    </div>
  );
}

/**
 * The rail's answer: where the plan ends in 90 days, how much the scenario
 * moves it, and where that leaves the balance, read as a statement. Then the
 * lowest point on the way, and at the foot what the scenario assumes.
 */
function ScenarioResult({
  result,
  text,
  stale,
  noData,
}: {
  result: SimulationResponse | undefined;
  text: ScenarioText | undefined;
  stale: boolean;
  noData: boolean;
}) {
  const t = useMessages(simulationMessages);
  const s$ = t.stats;
  const noDataYet = useMessages(common).delta.noData;
  const fmt = (cents: number) => money(cents, { decimals: 0, currency: result?.currency });
  const delta = result ? result.scenarioEndCents - result.baselineEndCents : 0;
  /** A figure; `spoken` is what assistive tech reads when the sign is drawn as the operator mark. */
  const value = (cents: number | undefined, tone = 'text-ink', spoken?: string) =>
    cents === undefined ? (
      <Skeleton className="ml-auto h-7 w-24" />
    ) : (
      <>
        <p
          aria-hidden={spoken ? true : undefined}
          className={cn('tabular text-figure-sm transition-colors duration-300', tone)}
        >
          <RollingText className="justify-items-end">{fmt(cents)}</RollingText>
        </p>
        {spoken && <span className="sr-only">{spoken}</span>}
      </>
    );
  const hint = (line: string) =>
    result ? <RollingText>{noData ? noDataYet : line}</RollingText> : null;
  const assumptions = text?.assumptions ?? [];

  return (
    <Panel
      className={cn(
        'flex flex-col p-5 transition-opacity duration-300 sm:p-6 xl:flex-1',
        stale && 'opacity-60',
      )}
      aria-labelledby="scenario-result"
    >
      <PanelHeader id="scenario-result" title={t.result.title} description={t.result.description} />
      <dl className="mt-2">
        <Line mark={<OperatorMark />} label={s$.currentPlan} hint={hint(s$.balanceIn90)}>
          {value(result?.baselineEndCents)}
        </Line>
        {/* The sign is the operator's: the figure is how far the scenario moves the balance. */}
        <Line
          mark={<OperatorMark kind={delta < 0 ? 'minus' : 'plus'} />}
          label={s$.difference}
          hint={hint(delta < 0 ? s$.less : s$.more)}
          className="border-t border-line-soft"
        >
          {value(
            result && Math.abs(delta),
            noData || delta === 0 ? 'text-ink' : delta < 0 ? 'text-negative' : 'text-positive',
            result && money(delta, { decimals: 0, sign: 'always', currency: result.currency }),
          )}
        </Line>
        {/* The result is ruled off, as on a statement. */}
        <Line
          mark={<OperatorMark kind="equals" />}
          label={s$.withScenario}
          hint={hint(s$.balanceIn90)}
          className="border-t border-line-strong"
        >
          {value(result?.scenarioEndCents)}
        </Line>
        <Line
          mark={<OperatorMark kind="low" />}
          label={s$.lowest}
          hint={hint(result ? formatDate(result.scenarioLowDate, 'd MMM yyyy') : '')}
          className="mt-3 border-t border-line"
        >
          {value(result?.scenarioLowCents)}
        </Line>
      </dl>

      {assumptions.length > 0 && (
        <section aria-labelledby="scenario-changes" className="mt-auto pt-5">
          <div className="border-t border-line pt-4">
            <h3 id="scenario-changes" className="text-body font-medium text-ink">
              {t.result.changes}
            </h3>
            <ul className="mt-2 flex flex-col gap-1.5">
              {assumptions.map((a) => (
                <li key={a} className="flex items-center gap-2.5 text-body-sm text-ink-2">
                  <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-chart-1" />
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </Panel>
  );
}

/** Exponential ease-out: switching scenarios feels quick and lands softly. */
const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** One scenario's heading and story; the one on its way out is hidden from assistive tech. */
function StoryLayer({ children }: { children: ReactNode }) {
  const present = useIsPresent();
  return (
    <motion.div
      aria-hidden={present ? undefined : true}
      className={cn('[grid-area:1/1]', !present && 'pointer-events-none')}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.26, ease: EASE_OUT } }}
      exit={{ opacity: 0, transition: { duration: 0.12, ease: 'linear' } }}
    >
      {children}
    </motion.div>
  );
}

function ScenarioDetail({
  result,
  text,
  scenarioKey,
  stale,
  noData,
}: {
  result: SimulationResponse | undefined;
  text: ScenarioText | undefined;
  /** Which scenario is shown, so switching to another can be animated. */
  scenarioKey: string;
  stale: boolean;
  /** No transactions: a flat plan, with nothing to compare. */
  noData: boolean;
}) {
  const t = useMessages(simulationMessages);
  const s$ = t.stats;
  const { role } = useCurrentMembership();
  if (!result || !text) {
    return (
      <div className="flex flex-col gap-6">
        <Panel className="p-6">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="mt-3 h-4 w-96 max-w-full" />
          <Skeleton className="mt-10 h-[300px] w-full" />
        </Panel>
        <Panel className="p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-6 h-32 w-full" />
        </Panel>
      </div>
    );
  }

  const fmt = (cents: number, sign: 'auto' | 'always' = 'auto') =>
    money(cents, { decimals: 0, sign, currency: result.currency });
  const projection = new Map(result.projection.map((p) => [p.date, p.balanceCents]));
  const first = result.projection[0]?.date;
  const last = result.projection.at(-1)?.date;
  const delta = result.scenarioEndCents - result.baselineEndCents;
  const diffAt = (p: { date: string; balanceCents: number }) =>
    (projection.get(p.date) ?? p.balanceCents) - p.balanceCents;
  // Which sides of the plan the scenario reaches, for the legend.
  const goesBelow = !noData && result.baseline.some((p) => diffAt(p) < 0);
  const goesAbove = !noData && result.baseline.some((p) => diffAt(p) > 0);
  // The lowest day is ringed only where the weekly line passes through it.
  const lowOnLine =
    projection.has(result.scenarioLowDate) &&
    result.scenarioLowDate !== first &&
    result.scenarioLowDate !== last;
  const callouts: LineCallout[] = [];
  if (!noData && last) {
    // Each line is labelled where it ends: the lower one beneath, the higher one above.
    if (delta !== 0) {
      callouts.push({
        date: last,
        value: result.baselineEndCents,
        label: fmt(result.baselineEndCents),
        below: delta > 0,
        secondary: true,
      });
    }
    callouts.push({
      date: last,
      value: result.scenarioEndCents,
      label: fmt(result.scenarioEndCents),
      below: delta < 0,
    });
    if (lowOnLine) {
      callouts.push({
        date: result.scenarioLowDate,
        value: result.scenarioLowCents,
        label: t.chart.lowestAt(fmt(result.scenarioLowCents)),
        below: true,
      });
    }
  }

  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col gap-6 transition-opacity duration-300',
        stale && 'opacity-60',
      )}
    >
      <Panel className="p-5 sm:p-6">
        {/* The new scenario's story rises in as the old one fades, in the same place, at once. */}
        <div className="grid">
          <AnimatePresence initial={false}>
            <StoryLayer key={scenarioKey}>
              <h2 className="text-figure-sm text-ink">{text.name}</h2>
              <p className="mt-1.5 max-w-[68ch] text-body text-ink-2">
                {noData ? t.page.noScenariosHint : text.description}
              </p>
            </StoryLayer>
          </AnimatePresence>
        </div>

        <div className="mt-6 border-t border-line pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 id="scenario-chart" className="text-title text-ink">
              {t.chart.title}
            </h3>
            <p className="text-body-sm text-muted">
              {noData ? t.page.noScenario : t.chart.description}
            </p>
          </div>
          <div className="relative mt-4">
            <div className={noData ? 'opacity-40' : undefined}>
              <LineChart
                height={300}
                ariaLabel={t.chart.label(text.name)}
                gap={{ from: 'baseline', to: 'scenario' }}
                callouts={callouts}
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
                    points: result.projection.map((p) => ({
                      date: p.date,
                      value: p.balanceCents,
                    })),
                  },
                ]}
                renderTooltip={(date) => {
                  const base = result.baseline.find((p) => p.date === date)?.balanceCents ?? 0;
                  const scenario = projection.get(date) ?? 0;
                  const diff = scenario - base;
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
                          swatch={diff < 0 ? 'bg-negative' : diff > 0 ? 'bg-positive' : undefined}
                          label={s$.difference}
                          value={fmt(diff, 'always')}
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
          <div className="mt-5 border-t border-line pt-4">
            <Legend
              items={[
                { label: s$.currentPlan, swatch: 'bg-chart-2' },
                { label: t.chart.scenario, swatch: 'bg-chart-1' },
                ...(goesBelow ? [{ label: t.chart.below, swatch: 'bg-negative/35' }] : []),
                ...(goesAbove ? [{ label: t.chart.above, swatch: 'bg-positive/35' }] : []),
              ]}
            />
          </div>
        </div>
      </Panel>

      <MonthComparison result={result} />
    </div>
  );
}

/**
 * The next three months' net cash flow, plan against scenario: a pair of
 * capsules per month on pale tracks (grey for the plan, ink for the
 * scenario), the figures beside them, and the difference in the colour of
 * what it means. A month that loses money runs left of the zero mark.
 */
function MonthComparison({ result }: { result: SimulationResponse }) {
  const t = useMessages(simulationMessages);
  const s$ = t.stats;
  const fmt = (cents: number) =>
    money(cents, { decimals: 0, sign: 'always', currency: result.currency });
  const values = result.months.flatMap((m) => [m.baselineNetCents, m.scenarioNetCents]);
  const low = Math.min(0, ...values);
  const span = Math.max(0, ...values) - low || 1;
  /** Where zero sits along the track, as a share of its width. */
  const zero = -low / span;

  const capsule = (cents: number, tone: string) => {
    const size = Math.abs(cents) / span;
    return (
      <span className="relative block h-2 rounded-full bg-chart-track/60">
        {cents !== 0 && (
          <motion.span
            className={cn('absolute inset-y-0 min-w-2 rounded-full', tone)}
            initial={false}
            animate={{
              left: `${(cents < 0 ? zero - size : zero) * 100}%`,
              width: `${size * 100}%`,
            }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
      </span>
    );
  };

  return (
    <Panel className="overflow-hidden xl:flex-1" aria-labelledby="scenario-months">
      <div className="px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
        <PanelHeader
          id="scenario-months"
          title={t.months.title}
          description={t.months.description}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-body-sm">
          <thead>
            {/* Sentence-case labels, as everywhere else: no tracked capitals. */}
            <tr className="border-t border-line text-left text-caption whitespace-nowrap text-muted">
              <th scope="col" className="h-10 pr-3 pl-5 font-medium sm:pl-6">
                {t.months.month}
              </th>
              <td aria-hidden className="hidden w-full px-3 sm:table-cell">
                <span className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-3.5 rounded-full bg-chart-2" />
                    {s$.currentPlan}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-3.5 rounded-full bg-chart-1" />
                    {t.chart.scenario}
                  </span>
                </span>
              </td>
              <th scope="col" className="px-2 text-right sm:px-3 font-medium">
                {s$.currentPlan}
              </th>
              <th scope="col" className="px-2 text-right sm:px-3 font-medium">
                {t.chart.scenario}
              </th>
              <th scope="col" className="pr-5 pl-2 text-right font-medium sm:pr-6 sm:pl-3">
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
                    className="py-4 pr-3 pl-5 text-left font-normal whitespace-nowrap text-ink sm:pl-6"
                  >
                    {/* Phones get the short month name, so all four columns fit. */}
                    <span className="sm:hidden">{formatDate(`${m.month}-01`, 'LLL yyyy')}</span>
                    <span className="hidden sm:inline">
                      {formatDate(`${m.month}-01`, 'LLLL yyyy')}
                    </span>
                  </th>
                  <td aria-hidden className="hidden min-w-40 px-3 sm:table-cell">
                    <span className="relative flex flex-col gap-1.5">
                      {capsule(m.baselineNetCents, 'bg-chart-2')}
                      {capsule(m.scenarioNetCents, 'bg-chart-1')}
                      {low < 0 && (
                        <span
                          className="absolute -inset-y-1.5 w-px bg-line-strong"
                          style={{ left: `${zero * 100}%` }}
                        />
                      )}
                    </span>
                  </td>
                  <td className="px-2 text-right sm:px-3 whitespace-nowrap text-ink-2">
                    <RollingText className="justify-items-end">
                      {fmt(m.baselineNetCents)}
                    </RollingText>
                  </td>
                  <td className="px-2 text-right sm:px-3 whitespace-nowrap text-ink">
                    <RollingText className="justify-items-end">
                      {fmt(m.scenarioNetCents)}
                    </RollingText>
                  </td>
                  <td
                    className={cn(
                      'pr-5 pl-2 text-right font-medium whitespace-nowrap sm:pl-3 transition-colors duration-300 sm:pr-6',
                      diff < 0 ? 'text-negative' : diff > 0 ? 'text-positive' : 'text-muted',
                    )}
                  >
                    <RollingText className="justify-items-end">{fmt(diff)}</RollingText>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
