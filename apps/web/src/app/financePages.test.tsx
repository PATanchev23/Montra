import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetSessionForTests } from '../api/session';
import { useUiStore } from '../stores/ui';
import { useToastStore } from '../stores/toasts';
import { ledgerServer, transaction } from '../test/ledgerApi';
import { pickDate } from '../test/datePicker';
import { polyfillRadix, renderTransactions } from '../test/renderTransactions';
import { TopBar } from './TopBar';

/*
 * Cash flow, Budgets, Simulations and Reports are computed by the API from the
 * business's own transactions (here, the fake runs the same shared engine).
 * A business with none sees the same pages at zero; nothing anywhere comes
 * from the TechStore sample.
 */

const pages = [
  {
    path: '/cash-flow',
    heading: 'Balance & projection',
    emptyLine: 'No upcoming payments yet',
    chartNote: 'Add your first transactions to see income and expenses month by month',
  },
  {
    path: '/budgets',
    heading: 'Where it went',
    emptyLine: 'No spending yet',
    chartNote: null,
  },
  {
    path: '/simulations',
    heading: 'Projected balance',
    emptyLine: 'No scenarios yet',
    chartNote: 'Add your first transactions to test decisions against your own cash flow',
  },
  {
    path: '/reports',
    heading: 'Monthly revenue',
    emptyLine: 'No revenue yet',
    chartNote: 'Add your first transactions to see revenue month by month',
  },
] as const;

/** Text only the TechStore sample shows, whichever page it is on. */
const SAMPLE_ONLY =
  /TechStore|Meta Ads|Marketplace payout|Increase ad spend|online store remains|Sample data/;

/** A small shop (the fake's today is 9 November 2026): rent every month, sales every week. */
const shop = () => [
  ...['2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01'].map((date, i) =>
    transaction({
      id: `rent-${i}`,
      type: 'EXPENSE',
      amountCents: 120_000,
      description: 'Shop rent',
      category: 'Rent',
      date,
    }),
  ),
  ...Array.from({ length: 16 }, (_, i) =>
    transaction({
      id: `sale-${i}`,
      type: 'INCOME',
      amountCents: 80_000,
      description: `Order ${i}`,
      category: 'Sales',
      date: new Date(Date.UTC(2026, 10, 9 - 7 * i)).toISOString().slice(0, 10),
    }),
  ),
  transaction({
    id: 'ads',
    type: 'EXPENSE',
    amountCents: 45_000,
    description: 'Search ads',
    category: 'Marketing',
    date: '2026-11-03',
  }),
];

beforeAll(polyfillRadix);
beforeEach(() => {
  resetSessionForTests();
  useToastStore.setState({ toasts: [] });
});
afterEach(() => {
  resetSessionForTests();
  useUiStore.setState({ language: 'en', scenarios: {} });
});

describe.each(pages)('$path with no transactions', ({ path, heading, emptyLine, chartNote }) => {
  it('lays the page out at zero for an owner', async () => {
    ledgerServer();
    renderTransactions(path);

    expect(await screen.findByText(heading)).toBeInTheDocument();
    expect(await screen.findByText(emptyLine)).toBeInTheDocument();
    expect(screen.getAllByText(/€0(?![\d,.])/).length).toBeGreaterThan(0);
    expect(screen.queryByText(SAMPLE_ONLY)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);

    if (chartNote) {
      expect(screen.getByText(chartNote)).toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: 'Import transactions' })[0]).toHaveAttribute(
        'href',
        '/transactions?import=new',
      );
    }
  });

  it('shows a viewer the same empty layout, with nothing that leads to an import', async () => {
    ledgerServer({ role: 'VIEWER' });
    renderTransactions(path);

    expect(await screen.findByText(heading)).toBeInTheDocument();
    expect(await screen.findByText(emptyLine)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Import|Add transaction/ })).not.toBeInTheDocument();
    if (chartNote) expect(screen.queryByText(chartNote)).not.toBeInTheDocument();
    expect(screen.queryByText(SAMPLE_ONLY)).not.toBeInTheDocument();
  });
});

describe('cash flow', () => {
  it('projects the business’s own recurring payments', async () => {
    ledgerServer({ transactions: shop() });
    renderTransactions('/cash-flow');

    const upcoming = await screen.findByRole('region', { name: 'Next 30 days' });
    const rent = (await within(upcoming).findByText('Shop rent')).closest('tr')!;
    expect(within(rent).getByText('Tue 1 Dec')).toBeInTheDocument();
    expect(within(rent).getByText('Scheduled')).toBeInTheDocument();
    expect(within(rent).getByText('−€1,200.00')).toBeInTheDocument();
    expect(screen.queryByText(SAMPLE_ONLY)).not.toBeInTheDocument();
  });

  it('starts the balance from the bank balance the owner enters', async () => {
    ledgerServer({ transactions: shop() });
    renderTransactions('/cash-flow');
    const u = userEvent.setup();

    expect(
      await screen.findByText(/Balances start from 0 until you enter what is in the bank today/),
    ).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Enter bank balance' }));
    await u.type(await screen.findByLabelText('Bank balance today (EUR)'), '12 500,50');
    await u.type(screen.getByLabelText('Warn me below (EUR)'), '5000');
    await u.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText(
        'Balances start from €12,500.50 in the bank on 9 Nov 2026, then follow your transactions.',
      ),
    ).toBeInTheDocument();
    const today = screen.getByText('Balance today').parentElement!;
    expect(within(today).getByText('€12,501')).toBeInTheDocument();
    // The warning level now has a headroom figure, where there was none.
    const headroom = screen.getByText('Headroom above buffer').parentElement!;
    expect(within(headroom).queryByText('No warning level set')).not.toBeInTheDocument();
    expect(within(headroom).getByText(/^€[\d,]+$/)).toBeInTheDocument();
  });

  it('explains when the bank balance and the transactions do not add up', async () => {
    // The shop's history earns €6,350 more than it spends, yet only €1,000 is in the bank.
    ledgerServer({
      transactions: shop(),
      cashSettings: {
        balanceCents: 100_000,
        balanceDate: '2026-11-09',
        lowBalanceThresholdCents: null,
      },
    });
    renderTransactions('/cash-flow');

    const note = await screen.findByRole('note');
    expect(note).toHaveTextContent('Your bank balance and your transactions don’t add up');
    expect(note).toHaveTextContent(
      'Since 1 Jul 2026 your transactions bring in €6,350 more than they pay out, but the bank held €1,000 on 9 Nov. For both to be true, you would have started at −€5,350.',
    );
    expect(within(note).getByRole('button', { name: 'Update bank balance' })).toBeInTheDocument();
  });

  it('takes a balance from when the records start, which the transactions carry to today', async () => {
    const api = ledgerServer({
      transactions: shop(),
      cashSettings: {
        balanceCents: 100_000,
        balanceDate: '2026-11-09',
        lowBalanceThresholdCents: null,
      },
    });
    renderTransactions('/cash-flow');
    const u = userEvent.setup();

    const note = await screen.findByRole('note');
    expect(note).toHaveTextContent(
      'If €1,000 was what you had before 1 Jul 2026, choose “When my records start”',
    );
    // The figures open just before the records, not a year back.
    expect(screen.getByText('Opening balance').parentElement).toHaveTextContent('30 Jun 2026');
    await u.click(within(note).getByRole('button', { name: 'Update bank balance' }));
    const dialog = await screen.findByRole('dialog', { name: 'Bank balance' });
    await u.click(within(dialog).getByRole('radio', { name: 'When my records start' }));
    expect(within(dialog).getByLabelText('Bank balance before 1 Jul 2026 (EUR)')).toHaveValue(
      '1000',
    );
    expect(dialog).toHaveTextContent(
      'Your records start from €1,000 before 1 Jul 2026; your transactions carry it forward to today.',
    );
    await u.click(within(dialog).getByRole('button', { name: 'Save' }));

    // €1,000 before the first transaction, plus the €6,350 the shop earned since: the two
    // agree now. Saved without a date, so older history imported later still adds on top.
    expect(
      await screen.findByText(
        'Balances start from €1,000.00 before your first transaction, then follow your transactions.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(api.state.cashSettings).toMatchObject({
      balanceCents: 100_000,
      balanceDate: null,
    });
    const today = screen.getByText('Balance today').parentElement!;
    expect(within(today).getByText('€7,350')).toBeInTheDocument();
  });

  it('takes a starting balance before there are any transactions', async () => {
    const api = ledgerServer({ transactions: [] });
    renderTransactions('/cash-flow');
    const u = userEvent.setup();

    await u.click(await screen.findByRole('button', { name: 'Enter bank balance' }));
    const dialog = await screen.findByRole('dialog', { name: 'Bank balance' });
    await u.click(within(dialog).getByRole('radio', { name: 'When my records start' }));
    await u.type(
      within(dialog).getByLabelText('Bank balance before your first transaction (EUR)'),
      '4000',
    );
    expect(dialog).toHaveTextContent(
      'Your transactions will be added on top of €4,000 as you record them.',
    );
    await u.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText(
        'Balances start from €4,000.00 before your first transaction, then follow your transactions.',
      ),
    ).toBeInTheDocument();
    expect(api.state.cashSettings).toMatchObject({ balanceCents: 400_000, balanceDate: null });
  });

  it('asks for the date when the balance is from another day', async () => {
    ledgerServer({ transactions: shop() });
    renderTransactions('/cash-flow');
    const u = userEvent.setup();

    await u.click(await screen.findByRole('button', { name: 'Bank balance' }));
    const dialog = await screen.findByRole('dialog', { name: 'Bank balance' });
    await u.type(within(dialog).getByLabelText('Bank balance today (EUR)'), '5000');
    await u.click(within(dialog).getByRole('radio', { name: 'Another date' }));
    await u.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByText('Choose the date this balance was true.')).toBeInTheDocument();

    // The first day of the records has transactions of its own: say which side the balance is on.
    await pickDate(u, within(dialog).getByLabelText('Date of the balance'), '2026-07-01');
    expect(dialog).toHaveTextContent(
      '€5,000 at the end of 1 Jul 2026, after that day’s transactions',
    );
    expect(dialog).toHaveTextContent(
      'Your records start on 1 Jul. If this was the balance before that day’s transactions, choose “When my records start”.',
    );
  });

  it('accepts an overdrawn balance and refuses one it cannot read', async () => {
    ledgerServer({ transactions: shop() });
    renderTransactions('/cash-flow');
    const u = userEvent.setup();

    await u.click(await screen.findByRole('button', { name: 'Bank balance' }));
    const field = await screen.findByLabelText('Bank balance today (EUR)');
    await u.type(field, '12 euros');
    await u.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Enter an amount such as 2500 or 2500.50.')).toBeInTheDocument();

    await u.clear(field);
    await u.type(field, '-300');
    await u.click(screen.getByRole('button', { name: 'Save' }));
    const today = (await screen.findByText('Balance today')).parentElement!;
    await waitFor(() => expect(within(today).getByText('−€300')).toBeInTheDocument());
    // Overdrawn after a history that earned money: the note explains the gap.
    expect(screen.getByRole('note')).toHaveTextContent('you would have started at −€6,650');
  });

  it('lets a viewer read the figures but not change the bank balance', async () => {
    ledgerServer({ transactions: shop(), role: 'VIEWER' });
    renderTransactions('/cash-flow');

    expect(
      await screen.findByText(
        'Balances start from 0: the owner has not entered the bank balance yet.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /bank balance/i })).not.toBeInTheDocument();
  });
});

describe('budgets', () => {
  it('explains empty bars when this month has no spending yet, and jumps to the latest', async () => {
    // Everything is from October; the fake's today is 9 November.
    ledgerServer({
      transactions: [
        transaction({ id: 'r', amountCents: 95_000, category: 'Rent', date: '2026-10-02' }),
      ],
      budgets: [{ category: 'Rent', limitCents: 95_000 }],
    });
    renderTransactions('/budgets');
    const u = userEvent.setup();

    expect(
      await screen.findByText(
        /^No spending recorded in November 2026 yet, so the bars are at 0\. Your latest expenses are from October 2026/,
      ),
    ).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Show October 2026' }));

    const categories = screen.getByRole('region', { name: 'Categories' });
    const rent = (await within(categories).findByText('Rent', { selector: 'p' })).closest('li')!;
    await waitFor(() => expect(rent).toHaveTextContent('€950 / €950'));
    expect(screen.queryByText(/^No spending recorded/)).not.toBeInTheDocument();
  });

  it('sets what is still due this month against what the budgets have left', async () => {
    // The fake's today is 9 November: November's rent is paid, a deposit is dated ahead.
    ledgerServer({
      transactions: [
        ...shop(),
        transaction({
          id: 'deposit',
          type: 'EXPENSE',
          amountCents: 120_000,
          description: 'Storage unit deposit',
          category: 'Rent',
          date: '2026-11-20',
        }),
      ],
      budgets: [{ category: 'Rent', limitCents: 200_000 }],
    });
    renderTransactions('/budgets');
    const u = userEvent.setup();

    const due = await screen.findByRole('region', { name: 'Still to pay this month' });
    expect(await within(due).findByText('Storage unit deposit')).toBeInTheDocument();
    // €2,000 budget, €1,200 spent: €800 left against €1,200 due, said in words.
    expect(within(due).getByText('€1,200 due')).toBeInTheDocument();
    expect(within(due).getByText(/€800 left in the budgets/)).toBeInTheDocument();
    expect(within(due).getByText('€400 more than the budgets have left')).toBeInTheDocument();

    // A month that is over has nothing left to pay: it shows how the last six months ran.
    await u.click(screen.getByRole('button', { name: 'Previous month' }));
    const history = await screen.findByRole('region', { name: 'Last six months' });
    expect(
      within(history).getByRole('table', {
        name: 'Spending in budgeted categories over the last six months',
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Still to pay this month' }),
    ).not.toBeInTheDocument();
  });

  it('recommends limits in the editor, which the owner can take and adjust', async () => {
    const api = ledgerServer({ transactions: shop() });
    renderTransactions('/budgets');
    const u = userEvent.setup();

    expect(await screen.findByText('No budgets yet')).toBeInTheDocument();
    // The recommendation lives in the editor, not on the page.
    expect(screen.queryByRole('region', { name: 'Recommended budget' })).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Set budgets' }));
    const sheet = await screen.findByRole('dialog', { name: 'Monthly budgets' });

    const advice = within(sheet).getByRole('region', { name: 'Recommended budget' });
    expect(
      await within(advice).findByText(
        'From your last 4 full months, checked against the income Montra expects.',
      ),
    ).toBeInTheDocument();
    expect(
      within(advice).getByText(/^Leaves €[\d,]+ of expected income unspent/),
    ).toBeInTheDocument();
    // A saving goal trims flexible costs; this shop only has rent, so it says why nothing moved.
    await u.click(within(advice).getByRole('radio', { name: 'Save 20%' }));
    expect(api.fetchMock.mock.calls.some(([url]) => String(url).endsWith('goal=save-20'))).toBe(
      true,
    );
    expect(
      await within(advice).findByText(/^Every category here is a steady monthly payment/),
    ).toBeInTheDocument();

    // Each category says why, with the recommended amount under its field; Marketing only started this month.
    const rentRow = within(sheet).getByLabelText('Rent').closest('li')!;
    expect(rentRow).toHaveTextContent('Repeats every month: €1,200.');
    expect(
      within(rentRow).getByRole('button', { name: 'Use the recommended limit for Rent' }),
    ).toHaveTextContent('Use €1,200');
    expect(within(sheet).getByLabelText('Marketing').closest('li')).toHaveTextContent(
      'No spending in the last three months',
    );

    await u.click(within(sheet).getByRole('button', { name: 'Use these limits' }));
    expect(within(sheet).getByLabelText('Rent')).toHaveValue('1200');
    expect(
      within(advice).getByText('The limits below match this recommendation.'),
    ).toBeInTheDocument();
    // One line can also be taken on its own after a change.
    await u.clear(within(sheet).getByLabelText('Rent'));
    await u.click(
      within(sheet).getByRole('button', { name: 'Use the recommended limit for Rent' }),
    );
    expect(within(sheet).getByLabelText('Rent')).toHaveValue('1200');

    await u.type(within(sheet).getByLabelText('Marketing'), '300');
    await u.click(within(sheet).getByRole('button', { name: 'Save budgets' }));

    expect(await screen.findByText('Budgets saved')).toBeInTheDocument();
    expect(api.state.budgets).toEqual([
      { category: 'Rent', limitCents: 120_000 },
      { category: 'Marketing', limitCents: 30_000 },
    ]);
    const categories = screen.getByRole('region', { name: 'Categories' });
    const marketing = (await within(categories).findByText('Marketing', { selector: 'p' })).closest(
      'li',
    )!;
    expect(within(marketing).getByText('Over by €150')).toBeInTheDocument();
    const rent = within(categories).getByText('Rent', { selector: 'p' }).closest('li')!;
    // Rent repeats every month, so reaching its limit is expected.
    expect(within(rent).getByText('Paid')).toBeInTheDocument();
  });

  it('shows a viewer the budgets without the editor', async () => {
    ledgerServer({
      transactions: shop(),
      role: 'VIEWER',
      budgets: [{ category: 'Rent', limitCents: 150_000 }],
    });
    renderTransactions('/budgets');

    const categories = await screen.findByRole('region', { name: 'Categories' });
    const rent = (await within(categories).findByText('Rent', { selector: 'p' })).closest('li')!;
    expect(rent).toHaveTextContent('€1,200 / €1,500');
    expect(rent).toHaveTextContent('€300 left');
    expect(screen.queryByRole('button', { name: 'Edit budgets' })).not.toBeInTheDocument();
  });
});

describe('simulations', () => {
  it('offers scenarios built from the business’s own figures and runs one the user builds', async () => {
    ledgerServer({ transactions: shop() });
    const router = renderTransactions('/simulations');
    const u = userEvent.setup();

    const list = await screen.findByRole('radiogroup', { name: 'Choose a scenario' });
    // Each one names the figure it came from: its rent, its one-off ad spend, its best month.
    expect(
      await screen.findByRole('heading', { name: 'A new monthly commitment' }),
    ).toBeInTheDocument();
    expect(
      within(list).getByText(
        'Rent is your largest monthly payment, at €1,200. What if another one that size started on 1 December?',
      ),
    ).toBeInTheDocument();
    expect(
      within(list).getByText(
        'Your largest one-off payment this year was €450 for “Search ads” on 3 Nov 2026. What if one like it came on 9 December?',
      ),
    ).toBeInTheDocument();
    // Its sales never dipped below a usual month, so there is no slowdown to size.
    expect(within(list).queryByText('Sales slow down')).not.toBeInTheDocument();

    // The next best are suggested in "New scenario", from its figures too: its best month.
    await u.click(screen.getByRole('button', { name: 'New scenario' }));
    const sheet = await screen.findByRole('dialog', { name: 'New scenario' });
    const suggestions = within(sheet).getByRole('region', { name: 'Suggested from your figures' });
    expect(
      within(suggestions).getByText(
        'August brought in 25% more than a usual month. What if that became your usual?',
      ),
    ).toBeInTheDocument();
    expect(within(list).queryByText('Sales grow')).not.toBeInTheDocument();
    await u.type(within(sheet).getByLabelText('New monthly cost (EUR)'), '1000');
    await u.click(within(sheet).getByRole('button', { name: 'Run scenario' }));

    expect(await screen.findByRole('heading', { name: 'Your scenario' })).toBeInTheDocument();
    expect(screen.getByText('€1,000 more each month from 1 December')).toBeInTheDocument();
    expect(router.state.location.search).toBe('?scenario=custom&monthlyCostCents=100000');
    // Three months of the new cost: 1 December, 1 January, 1 February.
    const difference = screen.getByText('Difference', { selector: 'dt' }).parentElement!;
    expect(within(difference).getByText('−€3,000')).toBeInTheDocument();
  });

  it('builds scenarios for a business a few weeks old from its weeks and its biggest sale', async () => {
    // Open since Monday 21 September: a sale every Tuesday, one slow week and one big order.
    const sales = [100_000, 100_000, 100_000, 70_000, 100_000, 100_000, 100_000].map(
      (amountCents, i) =>
        transaction({
          id: `sale-${i}`,
          type: 'INCOME',
          amountCents,
          description: `Order ${i + 1}`,
          category: 'Sales',
          date: new Date(Date.UTC(2026, 8, 22 + 7 * i)).toISOString().slice(0, 10),
        }),
    );
    const bigOrder = transaction({
      id: 'big-order',
      type: 'INCOME',
      amountCents: 400_000,
      description: 'Office fit-out',
      category: 'Sales',
      date: '2026-10-29',
    });
    ledgerServer({ transactions: [...sales, bigOrder] });
    renderTransactions('/simulations');

    const list = await screen.findByRole('radiogroup', { name: 'Choose a scenario' });
    expect(
      await within(list).findByText(
        'The week of 12 October brought in 30% less than a usual week. What if every week ran like that?',
      ),
    ).toBeInTheDocument();
    expect(
      within(list).getByText(
        'Your biggest sale this year was €4,000 for “Office fit-out” on 29 Oct 2026, 4 times a usual one. What if another like it came on 9 December?',
      ),
    ).toBeInTheDocument();
  });

  it('suggests more scenarios in New scenario, run by name or adjusted', async () => {
    // Advertising every month, varying and climbing; and the shop sells electronics.
    const ads = [30_000, 45_000, 20_000, 60_000].map((amountCents, i) =>
      transaction({
        id: `ads-${i}`,
        type: 'EXPENSE',
        amountCents,
        description: `Ads ${i + 7}/2026`,
        category: 'Marketing',
        date: `2026-${String(i + 7).padStart(2, '0')}-15`,
      }),
    );
    ledgerServer({ transactions: [...shop(), ...ads], industry: 'Electronics' });
    const router = renderTransactions('/simulations');
    const u = userEvent.setup();
    const list = await screen.findByRole('radiogroup', { name: 'Choose a scenario' });
    // What it sells has a busy season ahead.
    expect(
      within(list).getByText(
        'December is usually a busy month for electronics shops. What if you spent an extra month’s Marketing, €420, on 17 November to be ready?',
      ),
    ).toBeInTheDocument();
    expect(within(list).queryByText('Sales grow')).not.toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'New scenario' }));
    let sheet = await screen.findByRole('dialog', { name: 'New scenario' });
    const suggestions = within(sheet).getByRole('region', { name: 'Suggested from your figures' });
    const growth = within(suggestions).getByRole('button', { name: /Sales grow/ });
    await u.click(growth);
    expect(growth).toHaveAttribute('aria-pressed', 'true');
    // Opened, it shows what it changes and what it would do to the next 90 days.
    expect(growth).toHaveAttribute('aria-expanded', 'true');
    const details = within(suggestions).getByRole('region', { name: 'Over the next 90 days' });
    expect(within(suggestions).getByText('Income +25%')).toBeInTheDocument();
    expect(await within(details).findByText('More cash than planned')).toBeInTheDocument();
    // While it is open, the fields to build one by hand step aside.
    await waitFor(() =>
      expect(within(sheet).queryByLabelText('Change in income (%)')).not.toBeInTheDocument(),
    );
    expect(within(sheet).getByRole('button', { name: 'Run scenario' })).toBeInTheDocument();

    // Closed, it stays chosen and the fields come back holding its figures.
    await u.click(growth);
    expect(growth).toHaveAttribute('aria-expanded', 'false');
    expect(growth).toHaveAttribute('aria-pressed', 'true');
    expect(await within(sheet).findByLabelText('Change in income (%)')).toHaveValue('25');

    // Changed, it is no longer the suggestion.
    const income = within(sheet).getByLabelText('Change in income (%)');
    await u.clear(income);
    await u.type(income, '30');
    expect(growth).toHaveAttribute('aria-pressed', 'false');
    await u.click(growth);
    await u.click(within(sheet).getByRole('button', { name: 'Run scenario' }));

    expect(await screen.findByRole('heading', { name: 'Sales grow' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?scenario=income-growth');
    expect(within(list).getByRole('radio', { name: /Sales grow/ })).toBeChecked();

    // On the list now, it is no longer offered; a scenario built by hand joins it.
    await u.click(screen.getByRole('button', { name: 'New scenario' }));
    sheet = await screen.findByRole('dialog', { name: 'New scenario' });
    expect(within(sheet).queryByRole('button', { name: /Sales grow/ })).not.toBeInTheDocument();
    await u.type(within(sheet).getByLabelText('Change in income (%)'), '30');
    await u.click(within(sheet).getByRole('button', { name: 'Run scenario' }));
    expect(await screen.findByRole('heading', { name: 'Your scenario' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?scenario=custom&incomeChangePct=30');

    // Choosing another keeps both on the list, and the user's own comes back as built.
    await u.click(within(list).getByRole('radio', { name: /Sales grow/ }));
    expect(await screen.findByRole('heading', { name: 'Sales grow' })).toBeInTheDocument();
    expect(within(list).getByRole('radio', { name: /Your scenario/ })).toBeInTheDocument();
    await u.click(within(list).getByRole('radio', { name: /Your scenario/ }));
    expect(router.state.location.search).toBe('?scenario=custom&incomeChangePct=30');
  });

  it('removes scenarios from the list and offers removed suggestions again', async () => {
    ledgerServer({ transactions: shop() });
    const router = renderTransactions('/simulations');
    const u = userEvent.setup();
    const list = await screen.findByRole('radiogroup', { name: 'Choose a scenario' });

    // Add the suggestion, then take it off the list again: it is offered once more.
    await u.click(screen.getByRole('button', { name: 'New scenario' }));
    let sheet = await screen.findByRole('dialog', { name: 'New scenario' });
    await u.click(within(sheet).getByRole('button', { name: /Sales grow/ }));
    await u.click(within(sheet).getByRole('button', { name: 'Run scenario' }));
    expect(within(list).getByRole('radio', { name: /Sales grow/ })).toBeChecked();
    await u.click(within(list).getByRole('button', { name: 'Remove “Sales grow”' }));
    expect(within(list).queryByRole('radio', { name: /Sales grow/ })).not.toBeInTheDocument();
    // The one shown was removed, so the next on the list takes its place.
    expect(within(list).getAllByRole('radio')[0]).toBeChecked();
    expect(router.state.location.search).not.toContain('income-growth');

    // A ready-made one removed is offered in New scenario too.
    await u.click(within(list).getByRole('button', { name: 'Remove “A new monthly commitment”' }));
    expect(
      within(list).queryByRole('radio', { name: /A new monthly commitment/ }),
    ).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'New scenario' }));
    sheet = await screen.findByRole('dialog', { name: 'New scenario' });
    expect(within(sheet).getByRole('button', { name: /Sales grow/ })).toBeInTheDocument();
    expect(
      within(sheet).getByRole('button', { name: /A new monthly commitment/ }),
    ).toBeInTheDocument();
  });
});

describe('reports', () => {
  it('reports the year from the business’s transactions', async () => {
    ledgerServer({ transactions: shop() });
    renderTransactions('/reports');

    const pnl = await screen.findByRole('region', { name: 'Profit & loss' });
    expect(within(pnl).getByRole('rowheader', { name: 'Sales' })).toBeInTheDocument();
    expect(within(pnl).getByRole('rowheader', { name: 'Rent' })).toBeInTheDocument();
    const channels = screen.getByRole('region', { name: 'Revenue by category' });
    expect(within(channels).getByText('Sales')).toBeInTheDocument();
    expect(screen.queryByText(SAMPLE_ONLY)).not.toBeInTheDocument();
  });

  it('turns the exports off for a business with nothing to export', async () => {
    ledgerServer();
    renderTransactions('/reports');

    await screen.findByText('No revenue yet');
    expect(screen.getByRole('button', { name: 'Export P&L' })).toBeDisabled();
    for (const button of screen.getAllByRole('button', { name: /^Download/ })) {
      expect(button).toBeDisabled();
    }
  });
});

describe('the top bar', () => {
  const topBar = <TopBar onOpenNavigation={() => {}} />;

  it('has no sample badge, and no notifications without anything to report', async () => {
    ledgerServer();
    renderTransactions('/cash-flow', topBar);

    await screen.findByText('No upcoming payments yet');
    expect(screen.queryByText('Sample data')).not.toBeInTheDocument();
    const bell = screen.getByRole('button', { name: 'Notifications' });
    expect(bell.querySelector('span.rounded-full')).toBeNull();
  });

  it('notifies about an overspent budget', async () => {
    ledgerServer({
      transactions: shop(),
      budgets: [{ category: 'marketing', limitCents: 10_000 }],
    });
    renderTransactions('/cash-flow', topBar);
    const u = userEvent.setup();

    const bell = await screen.findByRole('button', { name: 'Notifications' });
    await u.click(bell);
    expect(await screen.findByText('marketing is over budget')).toBeInTheDocument();
    expect(screen.getByText('€450 spent of €100')).toBeInTheDocument();
  });

  it('offers the search on every page, account pages included', async () => {
    ledgerServer();
    renderTransactions('/settings', topBar);

    await screen.findByText('Settings');
    expect(screen.getByRole('combobox', { name: 'Search' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('fills the search from a transactions link and empties it on leaving', async () => {
    ledgerServer();
    const router = renderTransactions('/transactions?q=acme&range=all', topBar);

    const field = await screen.findByRole('combobox', { name: 'Search' });
    expect(field).toHaveValue('acme');

    await router.navigate('/cash-flow');
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Search' })).toHaveValue(''));
  });

  it('finds pages by name or by what they hold, and opens one from the keyboard', async () => {
    ledgerServer({ transactions: shop() });
    const router = renderTransactions('/cash-flow', topBar);
    const u = userEvent.setup();

    const field = await screen.findByRole('combobox', { name: 'Search' });
    await u.type(field, 'language');
    const listbox = await screen.findByRole('listbox', { name: 'Search' });
    expect(within(listbox).getByRole('option', { name: /Settings/ })).toBeInTheDocument();

    await u.keyboard('{ArrowDown}');
    expect(field).toHaveAttribute(
      'aria-activedescendant',
      within(listbox).getByRole('option', { name: /Settings/ }).id,
    );
    await u.keyboard('{Enter}');
    await waitFor(() => expect(router.state.location.pathname).toBe('/settings'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('finds budgets, categories and transactions, and opens the transaction chosen', async () => {
    ledgerServer({
      transactions: shop(),
      budgets: [{ category: 'Rent', limitCents: 150_000 }],
    });
    const router = renderTransactions('/', topBar);
    const u = userEvent.setup();

    await u.type(await screen.findByRole('combobox', { name: 'Search' }), 'rent');
    const listbox = await screen.findByRole('listbox', { name: 'Search' });
    const group = (name: string) => within(listbox).getByRole('group', { name });

    expect(await within(listbox).findByRole('group', { name: 'Budgets' })).toHaveTextContent(
      '€1,500 a month',
    );
    expect(group('Categories')).toHaveTextContent('5 transactions');
    const rents = await within(listbox).findAllByRole('option', { name: /Shop rent/ });
    // Five rents, five shown, so no "show all".
    expect(rents).toHaveLength(5);
    expect(within(listbox).queryByRole('option', { name: /Show all/ })).not.toBeInTheDocument();

    await u.click(rents[0]!);
    await waitFor(() => expect(router.state.location.pathname).toBe('/transactions'));
    expect(router.state.location.search).toContain('q=rent');
    const sheet = await screen.findByRole('dialog', { name: 'Transaction details' });
    expect(within(sheet).getAllByText('Shop rent')).not.toHaveLength(0);
  });

  it('lists every matching transaction on Enter, by text or by amount', async () => {
    ledgerServer({ transactions: shop() });
    const router = renderTransactions('/budgets', topBar);
    const u = userEvent.setup();

    await u.type(await screen.findByRole('combobox', { name: 'Search' }), '450{Enter}');
    await waitFor(() => expect(router.state.location.pathname).toBe('/transactions'));
    const shown = await screen.findByText(
      /Showing transactions whose description, category or amount matches “450”/,
    );
    expect(await screen.findByText('Search ads')).toBeInTheDocument();
    expect(screen.queryByText('Shop rent')).not.toBeInTheDocument();

    // The notice's own "Clear search", not the field's.
    await u.click(within(shown).getByRole('button', { name: 'Clear search' }));
    expect(await screen.findAllByText('Shop rent')).not.toHaveLength(0);
  });

  it('offers a viewer pages and transactions but no actions', async () => {
    ledgerServer({ transactions: shop(), role: 'VIEWER' });
    renderTransactions('/', topBar);
    const u = userEvent.setup();

    await u.type(await screen.findByRole('combobox', { name: 'Search' }), 'import');
    const listbox = await screen.findByRole('listbox', { name: 'Search' });
    expect(within(listbox).queryByRole('group', { name: 'Actions' })).not.toBeInTheDocument();
    // Shown under the field, and announced.
    expect(await screen.findAllByText(/Nothing matches “import”/)).toHaveLength(2);
  });
});

describe('in Bulgarian', () => {
  it('lays the empty pages out in Bulgarian', async () => {
    useUiStore.setState({ language: 'bg' });
    ledgerServer();
    renderTransactions('/cash-flow');

    expect(await screen.findByText('Все още няма предстоящи плащания')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Добавете първите си транзакции, за да видите приходите и разходите по месеци',
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Още няма данни').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Импортирай транзакции' })).toBeInTheDocument();
  });
});

describe('cash flow for a business with no transactions', () => {
  it('shows money out as €0, never as a negative zero', async () => {
    ledgerServer();
    renderTransactions('/cash-flow');

    await screen.findByText('No upcoming payments yet');
    expect(screen.queryByText('−€0')).not.toBeInTheDocument();
  });
});
