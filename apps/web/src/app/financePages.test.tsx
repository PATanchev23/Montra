import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetSessionForTests } from '../api/session';
import { useUiStore } from '../stores/ui';
import { useToastStore } from '../stores/toasts';
import { ledgerServer, transaction } from '../test/ledgerApi';
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
  useUiStore.setState({ language: 'en' });
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
    expect(await screen.findByText(/Balances start from −€300.00 in the bank/)).toBeInTheDocument();
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
  it('suggests limits from recent spending and compares the month with them', async () => {
    const api = ledgerServer({ transactions: shop() });
    renderTransactions('/budgets');
    const u = userEvent.setup();

    expect(await screen.findByText('No budgets yet')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Set budgets' }));
    const sheet = await screen.findByRole('dialog', { name: 'Monthly budgets' });
    // The categories the shop spends in, from its transactions.
    expect(within(sheet).getByText('Rent')).toBeInTheDocument();
    expect(within(sheet).getByText('About €1,200 a month lately')).toBeInTheDocument();
    expect(within(sheet).getByText('Marketing')).toBeInTheDocument();

    await u.click(within(sheet).getByRole('button', { name: 'Fill from averages' }));
    expect(within(sheet).getByLabelText(/Rent/)).toHaveValue('1200');
    await u.type(within(sheet).getByLabelText(/Marketing/), '300');
    await u.click(within(sheet).getByRole('button', { name: 'Save budgets' }));

    expect(await screen.findByText('Budgets saved')).toBeInTheDocument();
    expect(api.state.budgets).toEqual([
      { category: 'Rent', limitCents: 120_000 },
      { category: 'Marketing', limitCents: 30_000 },
    ]);
    const marketing = (await screen.findByText('Marketing', { selector: 'p' })).closest('li')!;
    expect(within(marketing).getByText('Over by €150')).toBeInTheDocument();
    const rent = screen.getByText('Rent', { selector: 'p' }).closest('li')!;
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

    const rent = (await screen.findByText('Rent', { selector: 'p' })).closest('li')!;
    expect(rent).toHaveTextContent('€1,200 / €1,500');
    expect(rent).toHaveTextContent('€300 left');
    expect(screen.queryByRole('button', { name: 'Edit budgets' })).not.toBeInTheDocument();
  });
});

describe('simulations', () => {
  it('offers scenarios sized to the business and runs one the user builds', async () => {
    ledgerServer({ transactions: shop() });
    const router = renderTransactions('/simulations');
    const u = userEvent.setup();

    const list = await screen.findByRole('radiogroup', { name: 'Choose a scenario' });
    expect(within(list).getByText('Rent costs rise')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Sales slow down' })).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'New scenario' }));
    const sheet = await screen.findByRole('dialog', { name: 'New scenario' });
    await u.type(within(sheet).getByLabelText('New monthly cost (EUR)'), '1000');
    await u.click(within(sheet).getByRole('button', { name: 'Run scenario' }));

    expect(await screen.findByRole('heading', { name: 'Your scenario' })).toBeInTheDocument();
    expect(screen.getByText('€1,000 more each month from 1 December')).toBeInTheDocument();
    expect(router.state.location.search).toBe('?scenario=custom&monthlyCostCents=100000');
    // Three months of the new cost: 1 December, 1 January, 1 February.
    const difference = screen.getByText('Difference', { selector: 'dt' }).parentElement!;
    expect(within(difference).getByText('−€3,000')).toBeInTheDocument();
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
