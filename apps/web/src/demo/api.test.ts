import { describe, expect, it } from 'vitest';
import {
  getBudgets,
  getCashFlow,
  getDashboard,
  getScenarioResult,
  listScenarios,
  listTransactions,
} from './api';

describe('TechStore sample data', () => {
  it('is deterministic', async () => {
    const a = await getDashboard({ unit: 'month', offset: 0 });
    const b = await getDashboard({ unit: 'month', offset: 0 });
    expect(a).toEqual(b);
    expect(a.kpis.balance.valueCents).toBeGreaterThan(0);
  });

  it('keeps the ledger consistent with the dashboard', async () => {
    const dashboard = await getDashboard({ unit: 'month', offset: 0 });
    const month = await listTransactions({ range: 'month', pageSize: 1000 });
    expect(month.totals.incomeCents).toBe(dashboard.kpis.revenue.valueCents);
    expect(month.totals.expenseCents).toBe(dashboard.kpis.expenses.valueCents);
  });

  it('filters, sorts and paginates transactions', async () => {
    const ads = await listTransactions({ categories: ['advertising'], range: 'all' });
    expect(ads.items.every((t) => t.categoryId === 'advertising')).toBe(true);

    const income = await listTransactions({ type: 'income', sort: 'amount-desc', pageSize: 10 });
    expect(income.items).toHaveLength(10);
    expect(income.items.every((t) => t.type === 'income')).toBe(true);
    const amounts = income.items.map((t) => t.amountCents);
    expect(amounts).toEqual([...amounts].sort((x, y) => y - x));

    const search = await listTransactions({ q: 'meta', range: 'all' });
    expect(search.total).toBeGreaterThan(0);
    expect(search.items.every((t) => /meta/i.test(`${t.description} ${t.counterparty}`))).toBe(
      true,
    );
  });

  it('projects a balance path that starts at today’s balance', async () => {
    const cashFlow = await getCashFlow();
    const today = cashFlow.balance.find((p) => !p.projected && p.date === '2026-10-25');
    expect(today?.balanceCents).toBe(cashFlow.stats.closingCents);
    expect(cashFlow.months.filter((m) => m.projected)).toHaveLength(3);
  });

  it('shows the cost of a hire in the scenario comparison', async () => {
    const scenarios = await listScenarios();
    expect(scenarios.map((s) => s.id)).toContain('hire-support');
    const hire = await getScenarioResult('hire-support');
    expect(hire.scenarioEndCents).toBeLessThan(hire.baselineEndCents);
  });

  it('reports budgets with pace only for the current month', async () => {
    const current = await getBudgets(0);
    const previous = await getBudgets(-1);
    expect(current.isCurrent).toBe(true);
    expect(current.elapsedRatio).toBeLessThan(1);
    expect(previous.elapsedRatio).toBe(1);
    expect(previous.daysLeft).toBe(0);
  });
});
