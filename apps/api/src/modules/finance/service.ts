import {
  buildAlerts,
  buildBudgetMonth,
  buildCashFlow,
  buildReport,
  categoryKey,
  currencySchema,
  DEFAULT_TIMEZONE,
  Ledger,
  scenarioPresets,
  simulate,
  todayIn,
  type AlertsResponse,
  type BudgetLimit,
  type BudgetLimitsResponse,
  type BudgetMonthResponse,
  type CashFlowResponse,
  type CashSettings,
  type CashSettingsRequest,
  type Currency,
  type ReportResponse,
  type ScenarioPresetsResponse,
  type ScenarioRule,
  type SimulationResponse,
  type UpdateBudgetsRequest,
} from '@montra/shared';
import type { Db } from '../../db';
import { AppError } from '../../lib/app-error';
import { fromDbDate, toDbDate } from '../transactions/service';

/*
 * Cash flow, budgets, simulations, reports and alerts. Each request loads the
 * business's ledger once and hands it to the shared forecasting engine
 * (packages/shared/src/forecast.ts), which does all the maths.
 */

function today(timeZone: string, now: Date): string {
  try {
    return todayIn(timeZone, now);
  } catch {
    // Time zones are validated when set; this guards against one later dropped from the runtime.
    return todayIn(DEFAULT_TIMEZONE, now);
  }
}

interface Loaded {
  ledger: Ledger;
  currency: Currency;
}

async function loadLedger(db: Db, businessId: string, now: Date): Promise<Loaded> {
  const [business, rows] = await db.$transaction([
    db.business.findUniqueOrThrow({
      where: { id: businessId },
      select: {
        currency: true,
        timezone: true,
        cashBalanceCents: true,
        cashBalanceDate: true,
        lowBalanceThresholdCents: true,
      },
    }),
    db.transaction.findMany({
      where: { businessId },
      select: { date: true, type: true, amountCents: true, category: true, description: true },
    }),
  ]);
  const settings: CashSettings = {
    balanceCents: business.cashBalanceCents,
    balanceDate: business.cashBalanceDate ? fromDbDate(business.cashBalanceDate) : null,
    lowBalanceThresholdCents: business.lowBalanceThresholdCents,
  };
  const entries = rows.map((row) => ({ ...row, date: fromDbDate(row.date) }));
  return {
    ledger: new Ledger(entries, today(business.timezone, now), settings),
    currency: currencySchema.parse(business.currency),
  };
}

async function loadLimits(db: Db, businessId: string): Promise<BudgetLimit[]> {
  return db.budget.findMany({
    where: { businessId },
    orderBy: { category: 'asc' },
    select: { category: true, limitCents: true },
  });
}

export async function getCashFlow(
  db: Db,
  businessId: string,
  now = new Date(),
): Promise<CashFlowResponse> {
  const { ledger, currency } = await loadLedger(db, businessId, now);
  return { currency, ...buildCashFlow(ledger) };
}

/** The balance is recorded as of today where the business is. */
export async function updateCashSettings(
  db: Db,
  businessId: string,
  input: CashSettingsRequest,
  now = new Date(),
): Promise<CashSettings> {
  const { timezone } = await db.business.findUniqueOrThrow({
    where: { id: businessId },
    select: { timezone: true },
  });
  const date = input.balanceCents === null ? null : today(timezone, now);
  await db.business.update({
    where: { id: businessId },
    data: {
      cashBalanceCents: input.balanceCents,
      cashBalanceDate: date === null ? null : toDbDate(date),
      lowBalanceThresholdCents: input.lowBalanceThresholdCents,
    },
  });
  return {
    balanceCents: input.balanceCents,
    balanceDate: date,
    lowBalanceThresholdCents: input.lowBalanceThresholdCents,
  };
}

export async function getBudgets(
  db: Db,
  businessId: string,
  month: string | undefined,
  now = new Date(),
): Promise<BudgetMonthResponse> {
  const [{ ledger, currency }, limits] = await Promise.all([
    loadLedger(db, businessId, now),
    loadLimits(db, businessId),
  ]);
  const current = ledger.today.slice(0, 7);
  if (month !== undefined && month > current) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Choose this month or an earlier one.');
  }
  return { currency, ...buildBudgetMonth(ledger, limits, month ?? current) };
}

/** Replaces every limit at once, as the editor saves them. */
export async function replaceBudgets(
  db: Db,
  businessId: string,
  { limits }: UpdateBudgetsRequest,
): Promise<BudgetLimitsResponse> {
  await db.$transaction([
    db.budget.deleteMany({ where: { businessId } }),
    db.budget.createMany({
      data: limits.map(({ category, limitCents }) => ({
        businessId,
        categoryKey: categoryKey(category),
        category: category.trim(),
        limitCents,
      })),
    }),
  ]);
  return { limits: await loadLimits(db, businessId) };
}

export async function getScenarioPresets(
  db: Db,
  businessId: string,
  now = new Date(),
): Promise<ScenarioPresetsResponse> {
  const { ledger } = await loadLedger(db, businessId, now);
  return { presets: scenarioPresets(ledger) };
}

export async function runSimulation(
  db: Db,
  businessId: string,
  rule: ScenarioRule,
  now = new Date(),
): Promise<SimulationResponse> {
  const { ledger, currency } = await loadLedger(db, businessId, now);
  return { currency, ...simulate(ledger, rule) };
}

export async function getReport(
  db: Db,
  businessId: string,
  year: number | undefined,
  now = new Date(),
): Promise<ReportResponse> {
  const { ledger, currency } = await loadLedger(db, businessId, now);
  const current = Number(ledger.today.slice(0, 4));
  if (year !== undefined && year > current) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Choose this year or an earlier one.');
  }
  return { currency, ...buildReport(ledger, year ?? current) };
}

export async function getAlerts(
  db: Db,
  businessId: string,
  now = new Date(),
): Promise<AlertsResponse> {
  const [{ ledger }, limits] = await Promise.all([
    loadLedger(db, businessId, now),
    loadLimits(db, businessId),
  ]);
  return { today: ledger.today, alerts: buildAlerts(ledger, limits) };
}
