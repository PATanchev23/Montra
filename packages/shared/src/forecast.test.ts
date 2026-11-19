import { describe, expect, it } from 'vitest';
import { isoAddDays } from './dashboard';
import type { CashSettings } from './finance';
import {
  buildAlerts,
  buildBudgetMonth,
  buildCashFlow,
  buildReport,
  Ledger,
  scenarioPresets,
  seriesKey,
  simulate,
  type LedgerEntry,
} from './forecast';

const TODAY = '2026-11-19';
const noSettings: CashSettings = {
  balanceCents: null,
  balanceDate: null,
  lowBalanceThresholdCents: null,
};

const entry = (overrides: Partial<LedgerEntry> & { date: string }): LedgerEntry => ({
  type: 'EXPENSE',
  amountCents: 10_000,
  category: 'Other',
  description: 'Payment',
  ...overrides,
});

/**
 * Six months of a small shop: rent on the 5th, salaries on the 25th, a
 * subscription whose price changed, sales every third day and supplies
 * every week.
 */
function shop(): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  for (const m of ['05', '06', '07', '08', '09', '10', '11']) {
    entries.push(
      entry({
        date: `2026-${m}-05`,
        amountCents: 120_000,
        category: 'Rent',
        description: `Rent ${m}/2026`,
      }),
    );
    if (m !== '11') {
      entries.push(
        entry({
          date: `2026-${m}-25`,
          amountCents: 300_000,
          category: 'Payroll',
          description: 'Salaries',
        }),
        entry({
          date: `2026-${m}-12`,
          amountCents: m < '09' ? 4_900 : 5_900,
          category: 'Software',
          description: 'Accounting app',
        }),
      );
    }
  }
  for (let d = 0; d < 180; d += 3) {
    entries.push(
      entry({
        date: isoAddDays(TODAY, -d),
        type: 'INCOME',
        amountCents: 30_000,
        category: 'Sales',
        description: `Order #${1000 + d}`,
      }),
    );
  }
  for (let d = 1; d < 180; d += 7) {
    entries.push(
      entry({
        date: isoAddDays(TODAY, -d),
        amountCents: 20_000,
        category: d % 2 ? 'supplies' : 'Supplies',
        description: 'Packaging',
      }),
    );
  }
  return entries;
}

describe('seriesKey', () => {
  it('reads the same payment through dates, numbers and month names', () => {
    expect(seriesKey('Rent — October 2026')).toBe('rent');
    expect(seriesKey('RENT 11/2026')).toBe('rent');
    expect(seriesKey('Наем октомври')).toBe('наем');
    expect(seriesKey('Order #1042')).toBe('order');
  });
});

describe('Ledger', () => {
  it('starts from zero without a bank balance, and from the owner’s balance with one', () => {
    const entries = [
      entry({ date: '2026-11-01', type: 'INCOME', amountCents: 50_000 }),
      entry({ date: '2026-11-10', amountCents: 20_000 }),
    ];
    expect(new Ledger(entries, TODAY, noSettings).balanceAt(TODAY)).toBe(30_000);

    // 1 000 € in the bank on 5 November, before the expense on the 10th.
    const ledger = new Ledger(entries, TODAY, {
      ...noSettings,
      balanceCents: 100_000,
      balanceDate: '2026-11-05',
    });
    expect(ledger.openingCents).toBe(50_000);
    expect(ledger.balanceAt('2026-11-05')).toBe(100_000);
    expect(ledger.balanceAt(TODAY)).toBe(80_000);
  });

  it('finds monthly payments and leaves weekly and ad-hoc ones alone', () => {
    const series = new Ledger(shop(), TODAY, noSettings).recurring();
    const found = Object.fromEntries(series.map((s) => [s.category, s]));

    expect(Object.keys(found).sort()).toEqual(['Payroll', 'Rent', 'Software']);
    expect(found.Rent).toMatchObject({
      amountCents: 120_000,
      day: 5,
      fixed: true,
      paidThisMonth: true,
    });
    expect(found.Payroll).toMatchObject({ amountCents: 300_000, day: 25, paidThisMonth: false });
    // The price went up in September: the median of the last three is the new one, and it varies.
    expect(found.Software).toMatchObject({ amountCents: 5_900, fixed: false });
  });

  it('stops expecting a payment that was not made last month or this one', () => {
    const entries = ['05', '06', '07', '08'].map((m) =>
      entry({ date: `2026-${m}-03`, description: 'Old lease', category: 'Rent' }),
    );
    expect(new Ledger(entries, TODAY, noSettings).recurring()).toEqual([]);
  });
});

describe('buildCashFlow', () => {
  it('lists the month’s remaining recurring payments with the balance after each', () => {
    const flow = buildCashFlow(new Ledger(shop(), TODAY, noSettings));

    const salaries = flow.upcoming.find((u) => u.description === 'Salaries')!;
    expect(salaries).toMatchObject({
      dueDate: '2026-11-25',
      type: 'EXPENSE',
      amountCents: 300_000,
      certainty: 'scheduled',
    });
    // Rent was paid on 5 November, so the next one is in December.
    expect(flow.upcoming.find((u) => u.category === 'Rent')?.dueDate).toBe('2026-12-05');
    expect(flow.upcoming.every((u) => u.dueDate > TODAY)).toBe(true);
    expect(flow.upcoming.every((u) => u.dueDate <= isoAddDays(TODAY, 30))).toBe(true);
  });

  it('gives twelve months of history, then three projected', () => {
    const flow = buildCashFlow(new Ledger(shop(), TODAY, noSettings));

    expect(flow.months.map((m) => m.month)).toEqual([
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ]);
    expect(flow.months.slice(0, 12).every((m) => !m.projected)).toBe(true);
    expect(flow.months.slice(12).every((m) => m.projected)).toBe(true);

    // December: rent, salaries and the subscription, plus about a month of supplies and sales.
    const december = flow.months[12]!;
    const fixed = 120_000 + 300_000 + 5_900;
    expect(december.expenseCents).toBeGreaterThan(fixed + 60_000);
    expect(december.expenseCents).toBeLessThan(fixed + 110_000);
    expect(december.incomeCents).toBeGreaterThan(280_000);
    expect(december.incomeCents).toBeLessThan(330_000);
  });

  it('projects the balance weekly with a widening range, from today’s balance', () => {
    const ledger = new Ledger(shop(), TODAY, {
      ...noSettings,
      balanceCents: 1_000_000,
      balanceDate: TODAY,
    });
    const flow = buildCashFlow(ledger);
    const future = flow.balance.filter((p) => p.projected);

    expect(flow.stats.closingCents).toBe(1_000_000);
    expect(flow.balance.find((p) => p.date === TODAY)).toMatchObject({
      balanceCents: 1_000_000,
      projected: false,
    });
    expect(future.at(-1)!.date).toBe(isoAddDays(TODAY, 90));
    expect(flow.stats.projectedCents).toBe(future.at(-1)!.balanceCents);
    const width = (p: (typeof future)[number]) => p.highCents! - p.lowCents!;
    expect(width(future.at(-1)!)).toBeGreaterThan(width(future[0]!));
    expect(flow.stats.lowestCents).toBeLessThanOrEqual(flow.stats.closingCents);
  });

  it('includes transactions dated after today as scheduled', () => {
    const entries = [
      ...shop(),
      entry({
        date: '2026-11-28',
        type: 'INCOME',
        amountCents: 500_000,
        description: 'Grant',
        category: 'Grants',
      }),
    ];
    const flow = buildCashFlow(new Ledger(entries, TODAY, noSettings));
    expect(flow.upcoming.find((u) => u.description === 'Grant')).toMatchObject({
      dueDate: '2026-11-28',
      certainty: 'scheduled',
    });
    // Not yet in the bank.
    expect(flow.stats.closingCents).toBe(new Ledger(shop(), TODAY, noSettings).balanceAt(TODAY));
  });

  it('is flat at zero for a business with no transactions', () => {
    const flow = buildCashFlow(new Ledger([], TODAY, noSettings));
    expect(flow.months.every((m) => m.incomeCents === 0 && m.expenseCents === 0)).toBe(true);
    expect(flow.balance.every((p) => p.balanceCents === 0)).toBe(true);
    expect(flow.upcoming).toEqual([]);
    expect(flow.stats).toMatchObject({ closingCents: 0, projectedCents: 0, lowestCents: 0 });
  });
});

describe('buildBudgetMonth', () => {
  const limits = [
    { category: 'Supplies', limitCents: 50_000 },
    { category: 'Rent', limitCents: 120_000 },
  ];

  it('compares spend with each limit, matching categories whatever their case', () => {
    const month = buildBudgetMonth(new Ledger(shop(), TODAY, noSettings), limits, '2026-11');
    const supplies = month.lines.find((l) => l.category === 'Supplies')!;

    // Packaging on 1, 8 and 15 November ('supplies' and 'Supplies').
    expect(supplies.spentCents).toBe(60_000);
    expect(supplies.paceCents).toBe(Math.round((50_000 * 19) / 30));
    expect(supplies.history).toHaveLength(6);
    expect(supplies.fixed).toBe(false);
    expect(month.lines.find((l) => l.category === 'Rent')).toMatchObject({
      spentCents: 120_000,
      fixed: true,
    });
    expect(month).toMatchObject({ isCurrent: true, daysInMonth: 30, daysElapsed: 19 });
    expect(month.totalSpentCents).toBe(180_000);
  });

  it('offers every expense category to budget, with its recent monthly average', () => {
    const month = buildBudgetMonth(new Ledger(shop(), TODAY, noSettings), limits, '2026-11');
    const names = month.categories.map((c) => c.category);

    expect(names).toEqual(expect.arrayContaining(['Payroll', 'Rent', 'Software', 'Supplies']));
    expect(names).not.toContain('Sales');
    expect(month.categories.find((c) => c.category === 'Payroll')).toMatchObject({
      limitCents: null,
      averageCents: 300_000,
    });
  });

  it('reads a past month in full', () => {
    const month = buildBudgetMonth(new Ledger(shop(), TODAY, noSettings), limits, '2026-10');
    expect(month).toMatchObject({ isCurrent: false, daysElapsed: 31, daysInMonth: 31 });
    expect(month.lines.find((l) => l.category === 'Rent')!.paceCents).toBe(120_000);
  });
});

describe('simulations', () => {
  it('sizes the presets to the business, and offers none without transactions', () => {
    const presets = scenarioPresets(new Ledger(shop(), TODAY, noSettings));
    expect(presets.map((p) => p.id)).toEqual([
      'income-drop',
      'top-cost-up',
      'new-monthly-cost',
      'one-off-purchase',
      'income-growth',
    ]);
    expect(presets[1]!.rule).toEqual({ category: 'Payroll', categoryChangePct: 20 });
    expect(scenarioPresets(new Ledger([], TODAY, noSettings))).toEqual([]);
  });

  it('applies a rule on top of the current plan', () => {
    const ledger = new Ledger(shop(), TODAY, noSettings);
    const none = simulate(ledger, {});
    expect(none.scenarioEndCents).toBe(none.baselineEndCents);

    const cost = simulate(ledger, { monthlyCostCents: 100_000 });
    // 1 December, 1 January and 1 February fall within 90 days of 19 November.
    expect(cost.baselineEndCents - cost.scenarioEndCents).toBe(300_000);
    expect(cost.months.map((m) => m.baselineNetCents - m.scenarioNetCents)).toEqual([
      100_000, 100_000, 100_000,
    ]);

    const oneOff = simulate(ledger, {
      oneOffType: 'EXPENSE',
      oneOffCents: 250_000,
      oneOffDate: '2026-12-10',
    });
    expect(oneOff.baselineEndCents - oneOff.scenarioEndCents).toBe(250_000);

    const drop = simulate(ledger, { incomeChangePct: -100 });
    expect(drop.months.every((m) => m.scenarioNetCents < m.baselineNetCents)).toBe(true);
  });
});

describe('buildReport', () => {
  it('sums the year by category and quarter, and projects the months to come', () => {
    const report = buildReport(new Ledger(shop(), TODAY, noSettings), 2026);
    const rent = report.rows.find((r) => r.category === 'Rent')!;

    expect(rent).toMatchObject({ type: 'EXPENSE', totalCents: 7 * 120_000 });
    // May–June, July–September, October–November.
    expect(rent.quarters).toEqual([0, 2 * 120_000, 3 * 120_000, 2 * 120_000]);
    // Both spellings, one row.
    expect(report.rows.filter((r) => r.category.toLowerCase() === 'supplies')).toHaveLength(1);
    expect(report.months.map((m) => m.projected)).toEqual([...Array(11).fill(false), true]);
    expect(report.channels).toEqual([
      { category: 'Sales', cents: report.summary.revenueCents, shareBasisPoints: 10_000 },
    ]);
    expect(report.asOf).toBe(TODAY);
    expect(report.years).toEqual([2026]);
  });

  it('has no margin without revenue', () => {
    expect(buildReport(new Ledger([], TODAY, noSettings), 2026).summary.margin).toBeNull();
  });
});

describe('buildAlerts', () => {
  it('warns about a payment due within three days, an overspent budget and a low balance', () => {
    const ledger = new Ledger(shop(), '2026-11-23', {
      balanceCents: 200_000,
      balanceDate: '2026-11-23',
      lowBalanceThresholdCents: 150_000,
    });
    const alerts = buildAlerts(ledger, [{ category: 'Supplies', limitCents: 10_000 }]);

    expect(alerts.map((a) => a.kind)).toEqual(['due-soon', 'over-budget', 'low-balance']);
    expect(alerts[0]).toMatchObject({ dueDate: '2026-11-25', description: 'Salaries' });
    expect(alerts[2]).toMatchObject({ date: '2026-11-25', thresholdCents: 150_000 });
  });

  it('says nothing about the balance until the owner has entered it', () => {
    const ledger = new Ledger(shop(), TODAY, { ...noSettings, lowBalanceThresholdCents: 1 });
    expect(buildAlerts(ledger, []).some((a) => a.kind === 'low-balance')).toBe(false);
  });
});
