import { z } from 'zod';
import { currencySchema } from './business';
import { MAX_CENTS } from './money';
import {
  amountCentsSchema,
  transactionCategorySchema,
  transactionDateSchema,
  transactionTypeSchema,
} from './transactions';

/*
 * Contracts for the pages that look ahead and summarise: Cash flow, Budgets,
 * Simulations, Reports and the alerts in the top bar. Every figure is computed
 * from the business's own transactions (see forecast.ts), plus the two things
 * a ledger cannot know: the bank balance today and the monthly budget limits.
 */

/** How far ahead every forecast looks. */
export const FORECAST_DAYS = 90;
/** Upcoming payments listed on Cash flow. */
export const UPCOMING_DAYS = 30;
export const BUDGET_MAX_LINES = 100;
/** Months of history the Budgets page can step back through. */
export const BUDGET_HISTORY_MONTHS = 12;

const signedCentsSchema = z.int().min(-MAX_CENTS).max(MAX_CENTS);
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use a month as YYYY-MM.');

/** One calendar month's money in and out. `projected` months come from the forecast. */
export const monthlyFlowSchema = z.object({
  /** yyyy-mm */
  month: z.string(),
  incomeCents: z.int(),
  expenseCents: z.int(),
  netCents: z.int(),
  projected: z.boolean(),
});
export type MonthlyFlow = z.infer<typeof monthlyFlowSchema>;

/** The balance at the end of a day; projected points carry a likely range. */
export const balancePointSchema = z.object({
  date: z.iso.date(),
  balanceCents: z.int(),
  lowCents: z.int().optional(),
  highCents: z.int().optional(),
  projected: z.boolean(),
});
export type BalancePoint = z.infer<typeof balancePointSchema>;

/**
 * A payment expected soon, from a series that repeats every month in the
 * ledger. `scheduled`: the same amount every time. `estimated`: it varies.
 */
export const upcomingPaymentSchema = z.object({
  id: z.string(),
  dueDate: z.iso.date(),
  description: z.string(),
  category: z.string(),
  type: transactionTypeSchema,
  amountCents: z.int().positive(),
  certainty: z.enum(['scheduled', 'estimated']),
  balanceAfterCents: z.int(),
});
export type UpcomingPayment = z.infer<typeof upcomingPaymentSchema>;

// ── Cash settings ───────────────────────────────────────────────────────

/**
 * PUT /businesses/:businessId/cash-settings. The bank balance on
 * `balanceDate` (today in the business's time zone when omitted, never
 * later); null forgets it. Negative means overdrawn. A balance from the start
 * of the records works as well as today's: the transactions carry it either way.
 */
export const cashSettingsRequestSchema = z.object({
  balanceCents: signedCentsSchema.nullable(),
  balanceDate: transactionDateSchema.optional(),
  lowBalanceThresholdCents: z
    .int('Enter a whole amount in cents.')
    .min(0, 'The threshold cannot be negative.')
    .max(MAX_CENTS, 'The threshold is too large.')
    .nullable(),
});
export type CashSettingsRequest = z.infer<typeof cashSettingsRequestSchema>;

export const cashSettingsSchema = z.object({
  /** The balance the owner entered, and the day it was true; both null when never set. */
  balanceCents: z.int().nullable(),
  balanceDate: z.iso.date().nullable(),
  lowBalanceThresholdCents: z.int().nullable(),
});
export type CashSettings = z.infer<typeof cashSettingsSchema>;

// ── Cash flow ───────────────────────────────────────────────────────────

/** GET /businesses/:businessId/cash-flow */
export const cashFlowResponseSchema = z.object({
  currency: currencySchema,
  /** Today in the business's time zone. */
  today: z.iso.date(),
  settings: cashSettingsSchema,
  transactionCount: z.int().min(0),
  /** The last 12 months (this one to date), then the next 3 projected. */
  months: z.array(monthlyFlowSchema),
  /** Weekly for the last 22 weeks, then weekly for FORECAST_DAYS. */
  balance: z.array(balancePointSchema),
  stats: z.object({
    /**
     * The balance where the figures start: the day before the 12-month
     * window, or the day before the first transaction when that is later.
     */
    openingDate: z.iso.date(),
    openingCents: z.int(),
    incomeCents: z.int(),
    expenseCents: z.int(),
    closingCents: z.int(),
    projectedCents: z.int(),
    lowestCents: z.int(),
    lowestDate: z.iso.date(),
  }),
  /**
   * Where the ledger starts: the day of the first transaction and the balance
   * just before it, worked back from the bank balance the owner entered (0
   * without one). Below zero with a balance entered, the two disagree: money
   * left that the transactions do not show, or the balance is out of date.
   * Null without transactions.
   */
  ledgerStart: z.object({ date: z.iso.date(), cents: z.int() }).nullable(),
  upcoming: z.array(upcomingPaymentSchema),
});
export type CashFlowResponse = z.infer<typeof cashFlowResponseSchema>;

// ── Budgets ─────────────────────────────────────────────────────────────

export const budgetQuerySchema = z.object({
  /** Defaults to this month. */
  month: monthSchema.optional(),
});

export const budgetLineSchema = z.object({
  category: z.string(),
  limitCents: z.int().positive(),
  spentCents: z.int().min(0),
  /** Spend expected by now if spending were spread evenly across the month. */
  paceCents: z.int().min(0),
  /** Spend in the six months ending with this one, oldest first. */
  history: z.array(z.int().min(0)),
  /** Mostly payments that repeat every month (rent, salaries): reaching the limit is expected. */
  fixed: z.boolean(),
});
export type BudgetLine = z.infer<typeof budgetLineSchema>;

/** GET /businesses/:businessId/budgets */
export const budgetMonthResponseSchema = z.object({
  currency: currencySchema,
  today: z.iso.date(),
  month: z.string(),
  isCurrent: z.boolean(),
  daysInMonth: z.int().positive(),
  /** Days of the month gone by: all of them for a past month. */
  daysElapsed: z.int().min(0),
  lines: z.array(budgetLineSchema),
  totalLimitCents: z.int().min(0),
  totalSpentCents: z.int().min(0),
  /**
   * The latest month (yyyy-mm, up to today) with any expense, so a month with
   * none yet can point to where the spending is; null without any expense.
   */
  latestExpenseMonth: z.string().nullable(),
  /**
   * Every expense category of the last 12 months, and every budgeted one,
   * for the editor: its limit (if set) and its average over the last three
   * full months.
   */
  categories: z.array(
    z.object({
      category: z.string(),
      limitCents: z.int().positive().nullable(),
      averageCents: z.int().min(0),
    }),
  ),
});
export type BudgetMonthResponse = z.infer<typeof budgetMonthResponseSchema>;

/** PUT /businesses/:businessId/budgets: replaces every limit. */
export const updateBudgetsRequestSchema = z.object({
  limits: z
    .array(z.object({ category: transactionCategorySchema, limitCents: amountCentsSchema }))
    .max(BUDGET_MAX_LINES, `Use at most ${BUDGET_MAX_LINES} budgets.`)
    .refine(
      (limits) =>
        new Set(limits.map((l) => l.category.toLocaleLowerCase('en'))).size === limits.length,
      { error: 'Each category can have one budget.' },
    ),
});
export type UpdateBudgetsRequest = z.infer<typeof updateBudgetsRequestSchema>;

export const budgetLimitsResponseSchema = z.object({
  limits: z.array(z.object({ category: z.string(), limitCents: z.int().positive() })),
});
export type BudgetLimitsResponse = z.infer<typeof budgetLimitsResponseSchema>;

/**
 * What a recommended budget aims for: spend no more than the income Montra
 * expects, or also leave 10% or 20% of it unspent.
 */
export const BUDGET_GOALS = ['within-income', 'save-10', 'save-20'] as const;
export const budgetGoalSchema = z.enum(BUDGET_GOALS);
export type BudgetGoal = z.infer<typeof budgetGoalSchema>;

export const budgetRecommendationQuerySchema = z.object({
  goal: budgetGoalSchema.default('within-income'),
});

/**
 * GET /businesses/:businessId/budgets/recommendation: a monthly limit for
 * every expense category, from the business's own history and checked
 * against the income it can expect.
 */
export const budgetRecommendationSchema = z.object({
  currency: currencySchema,
  today: z.iso.date(),
  goal: budgetGoalSchema,
  /** Full months of history the recommendation is drawn from (0 to 6). */
  monthsOfHistory: z.int().min(0),
  /** Average monthly income over the next three projected months; 0 when none is expected. */
  expectedIncomeCents: z.int().min(0),
  /** The most the goal allows to be spent each month; null without expected income. */
  targetCents: z.int().nullable(),
  totalCents: z.int().min(0),
  /** How far the total still exceeds the target after trimming as far as it goes; 0 when it fits. */
  overByCents: z.int().min(0),
  /** The bank balance is below the warning level, so the target also leaves room to recover. */
  recovering: z.boolean(),
  lines: z.array(
    z.object({
      category: z.string(),
      limitCents: z.int().positive(),
      /** What a typical month cost: the median of the months used. */
      usualCents: z.int().min(0),
      /** Payments that repeat every month in this category. */
      recurringCents: z.int().min(0),
      /** Mostly recurring: kept at its usual level, never trimmed. */
      fixed: z.boolean(),
      /** How much the usual level was cut to meet the goal, in whole percent. */
      trimmedPct: z.int().min(0).max(100),
      /** A single payment far above the usual month, left out of the usual level. */
      unusual: z.object({ amountCents: z.int().positive(), date: z.iso.date() }).nullable(),
    }),
  ),
});
export type BudgetRecommendation = z.infer<typeof budgetRecommendationSchema>;

// ── Simulations ─────────────────────────────────────────────────────────

const percentChange = z
  .int('Enter a whole percentage.')
  .min(-100, 'Use a change between −100% and +500%.')
  .max(500, 'Use a change between −100% and +500%.');

const ruleShape = {
  /** Every projected income, up or down by this percentage. */
  incomeChangePct: percentChange.optional(),
  /** Every projected expense, up or down by this percentage. */
  expenseChangePct: percentChange.optional(),
  /** One category (income or expense), changed on top of the above. */
  category: transactionCategorySchema.optional(),
  categoryChangePct: percentChange.optional(),
  /** A new cost every month from the first of next month. */
  monthlyCostCents: amountCentsSchema.optional(),
  /** A single payment in or out. */
  oneOffType: transactionTypeSchema.optional(),
  oneOffCents: amountCentsSchema.optional(),
  oneOffDate: transactionDateSchema.optional(),
};

type Rule = { [K in keyof typeof ruleShape]?: z.infer<(typeof ruleShape)[K]> };

function checkRule(rule: Rule, ctx: z.RefinementCtx) {
  if ((rule.category === undefined) !== (rule.categoryChangePct === undefined)) {
    ctx.addIssue({
      code: 'custom',
      path: [rule.category === undefined ? 'category' : 'categoryChangePct'],
      message: 'Choose a category and how much it changes.',
    });
  }
  const oneOff = [rule.oneOffType, rule.oneOffCents, rule.oneOffDate];
  if (oneOff.some((v) => v !== undefined) && oneOff.some((v) => v === undefined)) {
    ctx.addIssue({
      code: 'custom',
      path: ['oneOffCents'],
      message: 'Give the one-off payment a direction, an amount and a date.',
    });
  }
}

/** A what-if applied to the forecast. Every field is optional; none at all is the current plan. */
export const scenarioRuleSchema = z.object(ruleShape).superRefine(checkRule);
export type ScenarioRule = z.infer<typeof scenarioRuleSchema>;

/** The same rule read from a query string, where every value arrives as text. */
export const scenarioQuerySchema = z
  .object({
    incomeChangePct: z.coerce.number().pipe(percentChange).optional(),
    expenseChangePct: z.coerce.number().pipe(percentChange).optional(),
    category: ruleShape.category,
    categoryChangePct: z.coerce.number().pipe(percentChange).optional(),
    monthlyCostCents: z.coerce.number().pipe(amountCentsSchema).optional(),
    oneOffType: ruleShape.oneOffType,
    oneOffCents: z.coerce.number().pipe(amountCentsSchema).optional(),
    oneOffDate: ruleShape.oneOffDate,
  })
  .superRefine(checkRule);

export const SCENARIO_PRESET_IDS = [
  'income-drop',
  'top-cost-up',
  'new-monthly-cost',
  'one-off-purchase',
  'income-growth',
] as const;
export const scenarioPresetIdSchema = z.enum(SCENARIO_PRESET_IDS);
export type ScenarioPresetId = z.infer<typeof scenarioPresetIdSchema>;

/** GET /businesses/:businessId/simulations: ready-made what-ifs sized to this business. */
export const scenarioPresetsResponseSchema = z.object({
  presets: z.array(z.object({ id: scenarioPresetIdSchema, rule: scenarioRuleSchema })),
});
export type ScenarioPresetsResponse = z.infer<typeof scenarioPresetsResponseSchema>;
export type ScenarioPreset = ScenarioPresetsResponse['presets'][number];

/** GET /businesses/:businessId/simulations/run?<rule>: the plan with and without the rule. */
export const simulationResponseSchema = z.object({
  currency: currencySchema,
  today: z.iso.date(),
  /** Weekly balances over FORECAST_DAYS. */
  baseline: z.array(balancePointSchema),
  projection: z.array(balancePointSchema),
  baselineEndCents: z.int(),
  scenarioEndCents: z.int(),
  baselineLowCents: z.int(),
  scenarioLowCents: z.int(),
  scenarioLowDate: z.iso.date(),
  /** The next three calendar months. */
  months: z.array(
    z.object({ month: z.string(), baselineNetCents: z.int(), scenarioNetCents: z.int() }),
  ),
});
export type SimulationResponse = z.infer<typeof simulationResponseSchema>;

// ── Reports ─────────────────────────────────────────────────────────────

export const reportQuerySchema = z.object({
  year: z.coerce.number().int().min(1900).max(2199).optional(),
});

/** GET /businesses/:businessId/reports */
export const reportResponseSchema = z.object({
  currency: currencySchema,
  today: z.iso.date(),
  year: z.int(),
  /** The last day the figures cover: today for this year, 31 December for a past one. */
  asOf: z.iso.date(),
  summary: z.object({
    revenueCents: z.int(),
    expenseCents: z.int(),
    netCents: z.int(),
    /** Net over revenue; null without revenue. */
    margin: z.number().nullable(),
  }),
  /** One row per category and direction, by calendar quarter. */
  rows: z.array(
    z.object({
      category: z.string(),
      type: transactionTypeSchema,
      quarters: z.array(z.int()).length(4),
      totalCents: z.int(),
    }),
  ),
  /** January to December; months after today are projected. */
  months: z.array(monthlyFlowSchema),
  /** The largest income categories of the year. */
  channels: z.array(
    z.object({ category: z.string(), cents: z.int(), shareBasisPoints: z.int().min(0) }),
  ),
  /** Years that have transactions, newest first (always including this one). */
  years: z.array(z.int()),
});
export type ReportResponse = z.infer<typeof reportResponseSchema>;

// ── Alerts ──────────────────────────────────────────────────────────────

export const alertSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('due-soon'),
    dueDate: z.iso.date(),
    description: z.string(),
    amountCents: z.int().positive(),
  }),
  z.object({
    kind: z.literal('over-budget'),
    category: z.string(),
    spentCents: z.int(),
    limitCents: z.int(),
  }),
  z.object({
    kind: z.literal('low-balance'),
    date: z.iso.date(),
    balanceCents: z.int(),
    thresholdCents: z.int(),
  }),
]);
export type Alert = z.infer<typeof alertSchema>;

/** GET /businesses/:businessId/alerts: what needs attention, most urgent first. */
export const alertsResponseSchema = z.object({ today: z.iso.date(), alerts: z.array(alertSchema) });
export type AlertsResponse = z.infer<typeof alertsResponseSchema>;
