import { describe, expect, it } from 'vitest';
import { isoAddDays } from './dashboard';
import type { CashSettings } from './finance';
import {
  buildAlerts,
  buildBudgetMonth,
  buildCashFlow,
  buildReport,
  recommendBudget,
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
    expect(ledger.firstDate).toBe('2026-11-01');
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

  it('shows where the ledger starts, below zero when the balance and the history disagree', () => {
    // The history earns 300 €, but the owner says only 100 € is in the bank.
    const entries = [entry({ date: '2026-11-01', type: 'INCOME', amountCents: 30_000 })];
    const ledger = new Ledger(entries, TODAY, {
      ...noSettings,
      balanceCents: 10_000,
      balanceDate: TODAY,
    });
    expect(buildCashFlow(ledger).ledgerStart).toEqual({ date: '2026-11-01', cents: -20_000 });
  });

  it('opens just before the first transaction when the records are younger than a year', () => {
    const entries = [entry({ date: '2026-08-01', amountCents: 180_000, category: 'Rent' })];
    // 10 000 € at the end of 1 August, after that day's rent.
    const ledger = new Ledger(entries, TODAY, {
      ...noSettings,
      balanceCents: 1_000_000,
      balanceDate: '2026-08-01',
    });
    expect(buildCashFlow(ledger).stats).toMatchObject({
      openingDate: '2026-07-31',
      openingCents: 1_180_000,
    });
    // With nothing recorded, the year's window decides.
    expect(buildCashFlow(new Ledger([], TODAY, noSettings)).stats.openingDate).toBe('2025-11-30');
  });

  it('is flat at zero for a business with no transactions', () => {
    const flow = buildCashFlow(new Ledger([], TODAY, noSettings));
    expect(flow.months.every((m) => m.incomeCents === 0 && m.expenseCents === 0)).toBe(true);
    expect(flow.balance.every((p) => p.balanceCents === 0)).toBe(true);
    expect(flow.upcoming).toEqual([]);
    expect(flow.ledgerStart).toBeNull();
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
    expect(month).toMatchObject({
      isCurrent: true,
      daysInMonth: 30,
      daysElapsed: 19,
      latestExpenseMonth: '2026-11',
    });
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

  it('points to the latest month with expenses when this one has none yet', () => {
    const october = [entry({ date: '2026-10-12', amountCents: 5_000, category: 'Rent' })];
    const month = buildBudgetMonth(new Ledger(october, TODAY, noSettings), limits, '2026-11');
    expect(month.totalSpentCents).toBe(0);
    expect(month.latestExpenseMonth).toBe('2026-10');
    expect(
      buildBudgetMonth(new Ledger([], TODAY, noSettings), [], '2026-11').latestExpenseMonth,
    ).toBeNull();
  });

  it('reads a past month in full', () => {
    const month = buildBudgetMonth(new Ledger(shop(), TODAY, noSettings), limits, '2026-10');
    expect(month).toMatchObject({ isCurrent: false, daysElapsed: 31, daysInMonth: 31 });
    expect(month.lines.find((l) => l.category === 'Rent')!.paceCents).toBe(120_000);
  });
});

describe('simulations', () => {
  /** A profitable studio living off one client, with hosting climbing every month. */
  const studio = (): LedgerEntry[] =>
    ['06', '07', '08', '09', '10', '11'].flatMap((m, i) => [
      entry({
        date: `2026-${m}-03`,
        type: 'INCOME',
        amountCents: 600_000,
        category: 'Acme',
        description: 'Acme retainer',
      }),
      entry({
        date: `2026-${m}-15`,
        type: 'INCOME',
        amountCents: 200_000,
        category: 'Projects',
        description: `Project ${m}`,
      }),
      entry({ date: `2026-${m}-02`, amountCents: 150_000, category: 'Rent', description: 'Rent' }),
      entry({
        date: `2026-${m}-20`,
        amountCents: 20_000 + i * 15_000,
        category: 'Cloud',
        description: `Hosting ${m}`,
      }),
    ]);

  it('builds every scenario from the business’s own figures, and the same ones every time', () => {
    const ledger = () => new Ledger(studio(), TODAY, noSettings);
    const first = scenarioPresets(ledger());
    expect(scenarioPresets(ledger())).toEqual(first);

    expect(first.presets.slice(0, 3)).toEqual([
      // Hosting averaged 650 € over the last three full months against 350 € in July: 86% more.
      {
        id: 'rising-cost',
        rule: { category: 'Cloud', categoryChangePct: 86 },
        basis: { pct: 86 },
      },
      // Acme is 75% of the income: what if it stopped?
      {
        id: 'top-income-loss',
        rule: { category: 'Acme', categoryChangePct: -100 },
        basis: { pct: 75 },
      },
      // Another commitment the size of the rent it already pays.
      { id: 'new-monthly-cost', rule: { monthlyCostCents: 150_000 }, basis: { category: 'Rent' } },
    ]);
    const all = [...first.presets, ...first.suggested].map((p) => p.id);
    // Its income never strayed from a usual month, so nothing is sized to a stock percentage.
    expect(all).not.toContain('income-drop');
    expect(all).not.toContain('income-growth');
    expect(new Set(all).size).toBe(all.length);
    // Its cheapest month gives two more, offered in "New scenario".
    expect(first.suggested).toEqual([
      {
        id: 'costs-fall',
        rule: { expenseChangePct: -11 },
        basis: { month: '2026-07', pct: 11 },
      },
      {
        id: 'trim-cost',
        rule: { category: 'Cloud', categoryChangePct: -39 },
        basis: { month: '2026-07', cents: 35_000 },
      },
    ]);

    expect(scenarioPresets(new Ledger([], TODAY, noSettings))).toEqual({
      presets: [],
      suggested: [],
    });
  });

  it('sizes a slowdown to the business’s own weakest month', () => {
    const entries = studio().map((e) =>
      e.category === 'Projects' && e.date.startsWith('2026-08') ? { ...e, amountCents: 40_000 } : e,
    );
    const { presets, suggested } = scenarioPresets(new Ledger(entries, TODAY, noSettings));
    // August brought in 6 400 € against a usual 8 000 €: 20% less.
    expect([...presets, ...suggested].find((p) => p.id === 'income-drop')).toEqual({
      id: 'income-drop',
      rule: { incomeChangePct: -20 },
      basis: { month: '2026-08', pct: 20 },
    });
  });

  it('closes the gap where the shop spends more than it earns', () => {
    const { presets, suggested } = scenarioPresets(new Ledger(shop(), TODAY, noSettings));
    const injection = presets.find((p) => p.id === 'cash-injection')!;
    // Three months of its own monthly shortfall, which the basis names.
    expect(injection.rule.oneOffCents).toBe(
      Math.ceil((injection.basis.cents! * 3) / 10_000) * 10_000,
    );
    expect(injection.basis.cents).toBeGreaterThan(0);
    // With three to go round, the third is suggested in "New scenario".
    expect(suggested).toEqual([
      {
        id: 'new-monthly-cost',
        rule: { monthlyCostCents: 300_000 },
        basis: { category: 'Payroll' },
      },
    ]);
  });

  it('repeats the largest one-off payment of the past year on its anniversary', () => {
    const entries = [
      ...studio(),
      entry({
        date: '2025-12-08',
        amountCents: 400_000,
        category: 'Equipment',
        description: 'Laptops',
      }),
    ];
    const { presets, suggested } = scenarioPresets(new Ledger(entries, TODAY, noSettings));
    expect([...presets, ...suggested].find((p) => p.id === 'one-off-purchase')).toEqual({
      id: 'one-off-purchase',
      rule: { oneOffType: 'EXPENSE', oneOffCents: 400_000, oneOffDate: '2026-12-08' },
      basis: { description: 'Laptops', date: '2025-12-08' },
    });
  });

  /**
   * A shop open since Monday 28 September: one full month, so its pattern is
   * read week by week. A sale a week, a slow week of 19 October and one big
   * order on 11 November; supplies every week.
   */
  const newShop = (): LedgerEntry[] => [
    ...[100_000, 100_000, 100_000, 70_000, 100_000, 100_000].map((amountCents, i) =>
      entry({
        date: isoAddDays('2026-09-29', 7 * i),
        type: 'INCOME',
        amountCents,
        category: 'Sales',
        description: `Order ${i + 1}`,
      }),
    ),
    entry({
      date: '2026-11-11',
      type: 'INCOME',
      amountCents: 400_000,
      category: 'Sales',
      description: 'Office fit-out',
    }),
    ...Array.from({ length: 8 }, (_, i) =>
      entry({
        date: isoAddDays('2026-09-30', 7 * i),
        amountCents: 30_000,
        category: 'Supplies',
        description: 'Supplies',
      }),
    ),
  ];

  it('reads a business too new for a usual month week by week', () => {
    const { presets, suggested } = scenarioPresets(new Ledger(newShop(), TODAY, noSettings));
    const all = [...presets, ...suggested];
    // The week of 19 October brought in 70 000 against a usual 100 000.
    expect(all.find((p) => p.id === 'income-drop')).toEqual({
      id: 'income-drop',
      rule: { incomeChangePct: -30 },
      basis: { week: '2026-10-19', pct: 30 },
    });
    // The week of 9 November, with the big order, brought in four times a usual week.
    expect(all.find((p) => p.id === 'income-growth')).toEqual({
      id: 'income-growth',
      rule: { incomeChangePct: 300 },
      basis: { week: '2026-11-09', pct: 300 },
    });
    // Its weekly supplies never changed: nothing to size a cost scenario to.
    expect(all.map((p) => p.id)).not.toContain('top-cost-up');

    // Three weeks are not yet a pattern.
    const threeWeeks = newShop().filter((e) => e.date >= '2026-10-26');
    const young = scenarioPresets(new Ledger(threeWeeks, TODAY, noSettings));
    expect([...young.presets, ...young.suggested].map((p) => p.id)).not.toContain('income-drop');
  });

  it('offers the biggest sale again, from a handful of sales', () => {
    const { presets, suggested } = scenarioPresets(new Ledger(newShop(), TODAY, noSettings));
    // 4 000 € against a usual sale of 1 000 €; its anniversary is beyond the plan.
    expect([...presets, ...suggested].find((p) => p.id === 'big-sale')).toEqual({
      id: 'big-sale',
      rule: { oneOffType: 'INCOME', oneOffCents: 400_000, oneOffDate: '2026-12-19' },
      basis: { description: 'Office fit-out', date: '2026-11-11', pct: 400 },
    });
    // Sales all the same size have no big one.
    const all = [...scenarioPresets(new Ledger(shop(), TODAY, noSettings)).presets];
    expect(all.map((p) => p.id)).not.toContain('big-sale');
  });

  it('stocks up ahead of the busy season of what the business sells', () => {
    const find = (industry: string | null, entries = shop()) => {
      const { presets, suggested } = scenarioPresets(new Ledger(entries, TODAY, noSettings), {
        industry,
      });
      return [...presets, ...suggested].find((p) => p.id === 'peak-stock-up');
    };
    // December is the gift season for electronics: an extra month of supplies, bought tomorrow.
    expect(find('Consumer electronics')).toEqual({
      id: 'peak-stock-up',
      rule: { oneOffType: 'EXPENSE', oneOffCents: expect.any(Number), oneOffDate: '2026-11-20' },
      basis: { industry: 'electronics', month: '2026-12', category: 'supplies' },
    });
    // Outdoor gear sells in spring; and a business with no industry gets no season.
    expect(find('Спорт и туризъм')).toBeUndefined();
    expect(find(null)).toBeUndefined();

    // Its own sales last December say more than the industry does.
    const quietDecember = [
      ...shop(),
      entry({ date: '2025-12-01', type: 'INCOME', amountCents: 10_000, category: 'Sales' }),
    ];
    expect(find('Electronics', quietDecember)).toBeUndefined();
    const busyDecember = [
      ...shop(),
      entry({ date: '2025-12-01', type: 'INCOME', amountCents: 450_000, category: 'Sales' }),
    ];
    expect(find('Electronics', busyDecember)?.basis.pct).toBe(50);
  });

  it('puts the money needed first when the plan dips below the low-balance line', () => {
    const ledger = new Ledger(shop(), TODAY, {
      balanceCents: 500_000,
      balanceDate: TODAY,
      lowBalanceThresholdCents: 200_000,
    });
    const [first] = scenarioPresets(ledger).presets;
    expect(first!.id).toBe('cash-injection');
    // Enough to keep the plan above the line, a week before it would cross it.
    const result = simulate(ledger, first!.rule);
    expect(result.scenarioLowCents).toBeGreaterThanOrEqual(200_000);
    expect(first!.rule.oneOffDate! > TODAY).toBe(true);
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

describe('recommendBudget', () => {
  /** A café that earns more than it spends: weekly takings, rent, coffee beans with one big order. */
  function cafe(): LedgerEntry[] {
    const entries: LedgerEntry[] = [];
    for (let d = 0; d < 200; d += 7) {
      entries.push(
        entry({
          date: isoAddDays(TODAY, -d),
          type: 'INCOME',
          amountCents: 150_000,
          category: 'Sales',
          description: 'Weekly takings',
        }),
      );
    }
    for (const m of ['05', '06', '07', '08', '09', '10', '11']) {
      entries.push(
        entry({
          date: `2026-${m}-02`,
          amountCents: 100_000,
          category: 'Rent',
          description: 'Rent',
        }),
        entry({
          date: `2026-${m}-15`,
          amountCents: m === '08' ? 90_000 : 30_000,
          category: 'Beans',
          description: `Bean order ${m}`,
        }),
      );
    }
    return entries;
  }

  it('keeps usual spending when it fits the income, leaving one unusual order out', () => {
    const plan = recommendBudget(new Ledger(cafe(), TODAY, noSettings), 'within-income');

    expect(plan.monthsOfHistory).toBe(6);
    expect(plan.expectedIncomeCents).toBeGreaterThan(600_000);
    expect(plan.overByCents).toBe(0);
    expect(plan.lines).toEqual([
      {
        category: 'Rent',
        limitCents: 100_000,
        usualCents: 100_000,
        recurringCents: 100_000,
        fixed: true,
        trimmedPct: 0,
        unusual: null,
      },
      {
        category: 'Beans',
        limitCents: 30_000,
        usualCents: 30_000,
        recurringCents: 30_000,
        fixed: true,
        trimmedPct: 0,
        // August's order was three times the usual month.
        unusual: { amountCents: 90_000, date: '2026-08-15' },
      },
    ]);
  });

  it('trims flexible categories to meet the goal, and never the recurring ones', () => {
    const plan = recommendBudget(new Ledger(shop(), TODAY, noSettings), 'within-income');
    const line = (name: string) =>
      plan.lines.find((l) => l.category.toLowerCase() === name.toLowerCase())!;

    // Rent, salaries and the subscription repeat every month: commitments, kept whole.
    expect(line('Rent')).toMatchObject({ limitCents: 120_000, fixed: true, trimmedPct: 0 });
    expect(line('Payroll')).toMatchObject({ limitCents: 300_000, fixed: true, trimmedPct: 0 });
    // Packaging is flexible, and is cut as far as a trim goes.
    expect(line('Supplies')).toMatchObject({ fixed: false, trimmedPct: 50 });
    // Even so, this shop spends more than it earns: the gap is reported, not hidden.
    expect(plan.targetCents).toBe(plan.expectedIncomeCents);
    expect(plan.overByCents).toBe(plan.totalCents - plan.targetCents!);
    expect(plan.overByCents).toBeGreaterThan(0);
  });

  it('treats a monthly payment whose amount moves as flexible, not a commitment', () => {
    const stock = ['06', '07', '08', '09', '10'].map((m, i) =>
      entry({
        date: `2026-${m}-20`,
        amountCents: [400_000, 900_000, 500_000, 800_000, 600_000][i]!,
        category: 'Inventory',
        description: 'Stock order',
      }),
    );
    const plan = recommendBudget(new Ledger([...cafe(), ...stock], TODAY, noSettings), 'save-20');
    const inventory = plan.lines.find((l) => l.category === 'Inventory')!;

    // It repeats every month, but its size is a choice: trimmed like any flexible cost.
    expect(inventory.fixed).toBe(false);
    expect(inventory.recurringCents).toBe(0);
    expect(inventory.trimmedPct).toBeGreaterThan(0);
    expect(plan.lines.find((l) => l.category === 'Rent')).toMatchObject({
      fixed: true,
      trimmedPct: 0,
    });
  });

  it('asks for less as the goal saves more', () => {
    const ledger = new Ledger(shop(), TODAY, noSettings);
    const [within, save10, save20] = (['within-income', 'save-10', 'save-20'] as const).map(
      (goal) => recommendBudget(ledger, goal),
    );
    expect(save10!.targetCents!).toBeLessThan(within!.targetCents!);
    expect(save20!.targetCents!).toBe(Math.round(within!.targetCents! * 0.8));
  });

  it('leaves room to climb back above the warning level', () => {
    const below = new Ledger(cafe(), TODAY, {
      balanceCents: 100_000,
      balanceDate: TODAY,
      lowBalanceThresholdCents: 400_000,
    });
    const plan = recommendBudget(below, 'within-income');
    const plain = recommendBudget(new Ledger(cafe(), TODAY, noSettings), 'within-income');

    expect(plan.recovering).toBe(true);
    expect(plan.targetCents).toBe(plain.targetCents! - 100_000);
  });

  it('has nothing to recommend without history', () => {
    const plan = recommendBudget(new Ledger([], TODAY, noSettings), 'save-10');
    expect(plan).toMatchObject({ monthsOfHistory: 0, lines: [], targetCents: null, totalCents: 0 });
  });
});
