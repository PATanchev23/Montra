import {
  isoShiftMonth,
  type ScenarioBasis,
  type ScenarioPresetId,
  type ScenarioRule,
} from '@montra/shared';
import { messagesFor } from '../../i18n';
import { decimal, formatDate, money, percent } from '../../lib/format';
import { simulationMessages } from './messages';

/** A scenario the page can show: a preset sized by the API, or one the user built. */
export type ScenarioId = ScenarioPresetId | 'custom';

export interface ScenarioText {
  name: string;
  description: string;
  /** One short line per change the rule makes. */
  assumptions: string[];
}

/** A scenario as the API sends it: what changes, and the business's own figures behind it. */
export interface DescribedScenario {
  id: ScenarioId;
  rule: ScenarioRule;
  basis?: ScenarioBasis;
}

const pct = (value: number) => percent(value / 100, { signed: true });
/** The size of a change whose direction the sentence already gives. */
const size = (value: number) => percent(Math.abs(value) / 100);
/** For a month name that starts a sentence: Bulgarian writes months in lower case. */
const capitalised = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/**
 * A scenario in words, in the interface language. The API sends rules and
 * the figures they came from, not text, so the same preset reads naturally
 * in English and Bulgarian and says why it fits this business.
 */
export function describeScenario(
  { id, rule, basis = {} }: DescribedScenario,
  { currency, today }: { currency: string; today: string },
): ScenarioText {
  const m = messagesFor(simulationMessages).describe;
  const p = m.presets;
  const amount = (cents: number) => money(cents, { decimals: 0, currency });
  const day = (date: string | undefined) => (date ? formatDate(date, 'd MMMM') : '');
  const monthName = (key: string | undefined) => (key ? formatDate(`${key}-01`, 'LLLL') : '');
  const nextMonth = day(isoShiftMonth(today, 1));
  const category = rule.category ?? basis.category ?? '';

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

  const text = (() => {
    switch (id) {
      // A newer business's pattern is read week by week, named by its Monday.
      case 'income-drop':
        return basis.week
          ? p.incomeDropWeek(day(basis.week), size(basis.pct ?? 0))
          : p.incomeDrop(monthName(basis.month), size(basis.pct ?? 0));
      case 'income-growth':
        return basis.week
          ? p.incomeGrowthWeek(day(basis.week), size(basis.pct ?? 0))
          : p.incomeGrowth(monthName(basis.month), size(basis.pct ?? 0));
      case 'top-cost-up':
        return basis.week
          ? p.topCostUpWeek(category, day(basis.week), size(basis.pct ?? 0))
          : p.topCostUp(category, monthName(basis.month), size(basis.pct ?? 0));
      case 'new-monthly-cost':
        return p.newMonthlyCost(category, amount(rule.monthlyCostCents ?? 0), nextMonth);
      case 'one-off-purchase':
        return p.oneOffPurchase(
          basis.description ?? '',
          amount(rule.oneOffCents ?? 0),
          basis.date ? formatDate(basis.date, 'd MMM yyyy') : '',
          day(rule.oneOffDate),
        );
      case 'top-income-loss':
        return p.topIncomeLoss(category, size(basis.pct ?? 0));
      case 'rising-cost':
        return p.risingCost(category, size(basis.pct ?? 0));
      case 'trim-cost':
        return basis.week
          ? p.trimCostWeek(category, day(basis.week), amount(basis.cents ?? 0))
          : p.trimCost(category, monthName(basis.month), amount(basis.cents ?? 0));
      case 'big-sale':
        return p.bigSale(
          basis.description ?? '',
          amount(rule.oneOffCents ?? 0),
          basis.date ? formatDate(basis.date, 'd MMM yyyy') : '',
          decimal((basis.pct ?? 0) / 100),
          day(rule.oneOffDate),
        );
      case 'costs-rise':
        return basis.month
          ? p.costsRiseMonth(monthName(basis.month), size(basis.pct ?? 0))
          : p.costsRise(size(basis.pct ?? 0));
      case 'costs-fall':
        return p.costsFall(monthName(basis.month), size(basis.pct ?? 0));
      case 'peak-stock-up': {
        const month = monthName(basis.month);
        const why =
          basis.pct !== undefined
            ? p.peakLastYear(month, size(basis.pct))
            : basis.industry
              ? p.peakSeason(capitalised(month), p.industries[basis.industry])
              : '';
        const stock = p.peakStockUp(
          month,
          category,
          amount(rule.oneOffCents ?? 0),
          day(rule.oneOffDate),
        );
        return { ...stock, description: why ? `${why} ${stock.description}` : stock.description };
      }
      case 'cash-injection': {
        const cash = amount(rule.oneOffCents ?? 0);
        const on = day(rule.oneOffDate);
        const { name, description } = p.cashInjection(cash, on);
        if (basis.date) {
          const crossing = day(basis.date);
          return {
            name,
            description: basis.cents
              ? p.belowLine(amount(basis.cents), crossing, cash, on)
              : p.belowZero(crossing, cash, on),
          };
        }
        return {
          name,
          description: basis.cents ? p.shortfall(amount(basis.cents), cash, on) : description,
        };
      }
      case 'custom':
        return p.custom;
    }
  })();

  return {
    ...text,
    assumptions: assumptions.length || id !== 'custom' ? assumptions : [m.noChange],
  };
}
