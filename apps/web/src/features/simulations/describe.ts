import { isoShiftMonth, type ScenarioPresetId, type ScenarioRule } from '@montra/shared';
import { messagesFor } from '../../i18n';
import { formatDate, money, percent } from '../../lib/format';
import { simulationMessages } from './messages';

/** A scenario the page can show: a preset sized by the API, or one the user built. */
export type ScenarioId = ScenarioPresetId | 'custom';

export interface ScenarioText {
  name: string;
  description: string;
  /** One short line per change the rule makes. */
  assumptions: string[];
}

const pct = (value: number) => percent(value / 100, { signed: true });

/**
 * A scenario in words, in the interface language. The API sends rules, not
 * text, so the same preset reads naturally in English and Bulgarian.
 */
export function describeScenario(
  id: ScenarioId,
  rule: ScenarioRule,
  { currency, today }: { currency: string; today: string },
): ScenarioText {
  const m = messagesFor(simulationMessages).describe;
  const amount = (cents: number) => money(cents, { decimals: 0, currency });
  const nextMonth = formatDate(isoShiftMonth(today, 1), 'd MMMM');

  const assumptions: string[] = [];
  if (rule.incomeChangePct) assumptions.push(m.income(pct(rule.incomeChangePct)));
  if (rule.expenseChangePct) assumptions.push(m.expenses(pct(rule.expenseChangePct)));
  if (rule.category && rule.categoryChangePct !== undefined) {
    assumptions.push(m.category(rule.category, pct(rule.categoryChangePct)));
  }
  if (rule.monthlyCostCents) assumptions.push(m.monthly(amount(rule.monthlyCostCents), nextMonth));
  if (rule.oneOffType && rule.oneOffCents && rule.oneOffDate) {
    const date = formatDate(rule.oneOffDate, 'd MMM yyyy');
    assumptions.push(
      rule.oneOffType === 'INCOME'
        ? m.oneOffIn(amount(rule.oneOffCents), date)
        : m.oneOffOut(amount(rule.oneOffCents), date),
    );
  }

  switch (id) {
    case 'income-drop':
      return { ...m.presets.incomeDrop(pct(rule.incomeChangePct ?? 0)), assumptions };
    case 'income-growth':
      return { ...m.presets.incomeGrowth(pct(rule.incomeChangePct ?? 0)), assumptions };
    case 'top-cost-up':
      return {
        ...m.presets.topCostUp(rule.category ?? '', pct(rule.categoryChangePct ?? 0)),
        assumptions,
      };
    case 'new-monthly-cost':
      return {
        ...m.presets.newMonthlyCost(amount(rule.monthlyCostCents ?? 0), nextMonth),
        assumptions,
      };
    case 'one-off-purchase':
      return {
        ...m.presets.oneOffPurchase(
          amount(rule.oneOffCents ?? 0),
          rule.oneOffDate ? formatDate(rule.oneOffDate, 'd MMMM') : '',
        ),
        assumptions,
      };
    case 'custom':
      return { ...m.presets.custom, assumptions: assumptions.length ? assumptions : [m.noChange] };
  }
}
