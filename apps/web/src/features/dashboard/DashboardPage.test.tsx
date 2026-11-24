import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { resetSessionForTests } from '../../api/session';
import { useToastStore } from '../../stores/toasts';
import { useUiStore } from '../../stores/ui';
import { apiError } from '../../test/authApi';
import { ledgerServer, transaction } from '../../test/ledgerApi';
import { pickDate } from '../../test/datePicker';
import { polyfillRadix, renderTransactions } from '../../test/renderTransactions';
import { PeriodPicker } from './PeriodPicker';

/*
 * The fake API's "today" is 9 November 2026, so the default period (last
 * 30 days) is 11 Oct – 9 Nov, compared with 11 Sep – 10 Oct.
 */
const history = () => [
  transaction({
    id: 't1',
    type: 'INCOME',
    amountCents: 150_000,
    description: 'Wholesale order',
    category: 'Sales',
    date: '2026-11-05',
  }),
  transaction({
    id: 't2',
    type: 'EXPENSE',
    amountCents: 8_999,
    description: 'Website hosting',
    category: 'Software',
    date: '2026-11-04',
  }),
  transaction({
    id: 't3',
    type: 'EXPENSE',
    amountCents: 31_045,
    description: 'Facebook Ads',
    category: 'Advertising',
    date: '2026-10-20',
  }),
  // The comparison period.
  transaction({
    id: 't4',
    type: 'INCOME',
    amountCents: 100_000,
    description: 'Marketplace payout',
    category: 'Sales',
    date: '2026-10-01',
  }),
  transaction({
    id: 't5',
    type: 'EXPENSE',
    amountCents: 50_000,
    description: 'Office rent',
    category: 'Rent',
    date: '2026-09-15',
  }),
];

/** The capsule chart's panel, whose summary line carries the period's money in and out. */
const overview = () => screen.getByRole('region', { name: 'Cash flow overview' });
/** Waits for the period's income, as the chart's summary states it ("€1,500 in · …"). */
const findIn = async (amount: string) =>
  within(await screen.findByRole('region', { name: 'Cash flow overview' })).findByText(
    new RegExp(`^${amount.replace(/[$.]/g, '\\$&')} in · `),
  );

beforeAll(polyfillRadix);
beforeEach(() => {
  resetSessionForTests();
  useToastStore.setState({ toasts: [] });
  useUiStore.setState({ period: { period: '30d' } });
});
afterEach(() => resetSessionForTests());

describe('dashboard figures', () => {
  it('shows the period’s money in and out, day by day, from the API', async () => {
    const api = ledgerServer({ transactions: history(), currency: 'USD' });
    renderTransactions('/');

    expect(await findIn('US$1,500')).toBeInTheDocument();
    // Income, expenses and net in one line; the chart draws both, so there is no switch between them.
    expect(
      within(overview()).getByText('US$1,500 in · US$400 out · +US$1,100 net'),
    ).toBeInTheDocument();
    expect(within(overview()).queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.getByText(/TechStore performed in the last 30 days/)).toBeInTheDocument();
    expect(screen.getByText(/11 Oct – 9 Nov 2026 · 3 transactions/)).toBeInTheDocument();
    // The chart's data is also there as a table, for screen readers.
    expect(
      within(overview()).getByRole('table', { name: 'Income and expenses by day, Last 30 days' }),
    ).toBeInTheDocument();
    expect(api.dashboardQueries()).toEqual([{ period: '30d' }]);

    // What has a page of its own is not repeated here.
    expect(screen.queryByRole('region', { name: 'Expense breakdown' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Recent transactions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Scenario preview' })).not.toBeInTheDocument();

    expect(
      screen.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening), / }),
    ).toBeInTheDocument();
  });

  it('fills the runway, budgets, what is coming up and what needs attention from the business’s own figures', async () => {
    ledgerServer({
      transactions: [
        ...history(),
        // Rent on the 1st of every month: a recurring payment, due again on 1 December.
        ...['2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01'].map((date, i) =>
          transaction({
            id: `rent-${i}`,
            type: 'EXPENSE',
            amountCents: 120_000,
            description: 'Shop rent',
            category: 'Rent',
            date,
          }),
        ),
      ],
      budgets: [
        { category: 'Rent', limitCents: 100_000 },
        { category: 'Software', limitCents: 20_000 },
      ],
    });
    renderTransactions('/');

    const upcoming = await screen.findByRole('region', { name: 'Coming up' });
    expect(await within(upcoming).findByText('Shop rent')).toBeInTheDocument();
    expect(within(upcoming).getAllByText(/^then /).length).toBeGreaterThan(0);
    expect(
      within(upcoming).getByRole('link', { name: 'View all upcoming payments' }),
    ).toHaveAttribute('href', '/cash-flow#upcoming');

    // Four rents against two sales leave the balance below zero: no runway, said in words.
    const runway = screen.getByRole('region', { name: 'Runway' });
    expect(
      await within(runway).findByText('No runway: the balance is at or below zero.'),
    ).toBeInTheDocument();
    expect(
      within(runway).getByRole('img', { name: 'Runway: 0 months of spending' }),
    ).toBeInTheDocument();

    // November: rent €1,200 against €1,000, software €89.99 against €200.
    const budgets = screen.getByRole('region', { name: 'Budget used' });
    expect(await within(budgets).findByText('€1,290 of €1,200')).toBeInTheDocument();
    expect(within(budgets).getByText('€90 over the budgets')).toBeInTheDocument();

    const attention = screen.getByRole('region', { name: 'Needs your attention' });
    expect(await within(attention).findByText('Rent is over budget')).toBeInTheDocument();

    // No sample data anywhere.
    expect(screen.queryByText(/Sample data|TechStore sample/)).not.toBeInTheDocument();
  });

  it('opens with where cash stands and where it is heading', async () => {
    ledgerServer({ transactions: history() });
    renderTransactions('/');

    // No bank balance entered yet: the panel says the figure counts from zero, and how to fix it.
    const cash = await screen.findByRole('region', { name: 'Cash from your transactions' });
    expect(await within(cash).findByText(/over the next 90 days/)).toBeInTheDocument();
    expect(within(cash).getByText('Lowest ahead')).toBeInTheDocument();
    expect(within(cash).getByText(/Balances start from 0 until you enter/)).toBeInTheDocument();
    expect(within(cash).getByRole('link', { name: /Enter bank balance/ })).toHaveAttribute(
      'href',
      '/cash-flow',
    );
  });

  it('reloads for another reporting period', async () => {
    const api = ledgerServer({ transactions: history() });
    renderTransactions('/', <PeriodPicker />);
    const u = userEvent.setup();
    await findIn('€1,500');

    await u.click(screen.getByRole('button', { name: 'Reporting period: Last 30 days' }));
    await u.click(await screen.findByRole('menuitemradio', { name: /Last month/ }));

    expect(await findIn('€1,000')).toBeInTheDocument();
    expect(within(overview()).getByText('€1,000 in · €310 out · +€690 net')).toBeInTheDocument();
    expect(api.dashboardQueries().at(-1)).toEqual({ period: 'last-month' });
    expect(screen.getByText(/TechStore performed in October 2026/)).toBeInTheDocument();
    expect(screen.getByText(/1 – 31 Oct 2026 · 2 transactions/)).toBeInTheDocument();
  });

  it('switches between the quick periods in one tap', async () => {
    const api = ledgerServer({ transactions: history() });
    renderTransactions('/');
    const u = userEvent.setup();
    await findIn('€1,500');
    expect(screen.getByRole('radio', { name: '30 days' })).toBeChecked();

    await u.click(screen.getByRole('radio', { name: '90 days' }));

    expect(await findIn('€2,500')).toBeInTheDocument();
    expect(api.dashboardQueries().at(-1)).toEqual({ period: '90d' });
    expect(screen.getByRole('radio', { name: '90 days' })).toBeChecked();
    expect(screen.getByText(/TechStore performed in the last 90 days/)).toBeInTheDocument();
  });

  it('takes a custom range, refusing one that runs backwards', async () => {
    // The custom range starts from "today" in the business's time zone; pin the
    // clock to the fake API's today so the expected dates hold on any day.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-09T12:00:00Z'));
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const api = ledgerServer({ transactions: history() });
    renderTransactions('/', <PeriodPicker />);
    const u = userEvent.setup();
    await findIn('€1,500');

    await u.click(screen.getByRole('button', { name: 'Reporting period: Last 30 days' }));
    await u.click(await screen.findByRole('menuitemradio', { name: /Custom range/ }));
    // It starts from the dates that were on screen.
    expect(screen.getByLabelText('From date')).toHaveAttribute('data-value', '2026-10-11');
    expect(screen.getByLabelText('From date')).toHaveTextContent('11 Oct 2026');
    expect(screen.getByLabelText('To date')).toHaveAttribute('data-value', '2026-11-09');

    const before = api.dashboardQueries().length;
    await pickDate(u, screen.getByLabelText('From date'), '2026-12-01');
    expect(await screen.findByText('Check the date range')).toBeInTheDocument();
    expect(screen.getByText('The start date is after the end date.')).toBeInTheDocument();
    expect(
      api
        .dashboardQueries()
        .slice(before)
        .every((q) => q.from !== '2026-12-01'),
    ).toBe(true);

    await pickDate(u, screen.getByLabelText('From date'), '2026-09-01');
    await waitFor(() =>
      expect(api.dashboardQueries().at(-1)).toEqual({
        period: 'custom',
        from: '2026-09-01',
        to: '2026-11-09',
      }),
    );
    expect(await findIn('€2,500')).toBeInTheDocument();
    expect(within(overview()).getByText('€2,500 in · €900 out · +€1,600 net')).toBeInTheDocument();
  });
});

describe('dashboard states', () => {
  it('shows an error with a way to try again', async () => {
    const api = ledgerServer({ transactions: history() });
    api.state.override = (_method, url) =>
      url.pathname.endsWith('/dashboard')
        ? apiError(404, 'NOT_FOUND', 'Business not found.')
        : undefined;
    renderTransactions('/');

    expect(await screen.findByText('Business not found.')).toBeInTheDocument();
    api.state.override = null;
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));
    expect(await findIn('€1,500')).toBeInTheDocument();
  });

  it('keeps the layout for a business with no transactions, inviting the owner to start', async () => {
    ledgerServer();
    renderTransactions('/');

    expect(
      await screen.findByText('Add your first transactions to see how TechStore is doing.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/0 transactions/)).toBeInTheDocument();

    // The chart stays, readable by keyboard and screen reader, behind a note and an Import button.
    expect(
      screen.getByText('Add your first transactions to see your daily cash flow'),
    ).toBeInTheDocument();
    expect(
      within(overview()).getByRole('table', { name: 'Income and expenses by day, Last 30 days' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Import transactions' })).toHaveAttribute(
      'href',
      '/transactions?import=new',
    );

    // In place of alerts, the first steps, with the owner's two ways in.
    const start = screen.getByRole('region', { name: 'Get started' });
    expect(within(start).getByText('Bring in your transactions')).toBeInTheDocument();
    expect(within(start).getByText('Enter your bank balance')).toBeInTheDocument();
    expect(within(start).getByText('Set monthly budgets')).toBeInTheDocument();
    expect(within(start).getByRole('link', { name: 'Import' })).toHaveAttribute(
      'href',
      '/transactions?import=new',
    );
    expect(within(start).getByRole('link', { name: 'Add transaction' })).toHaveAttribute(
      'href',
      '/transactions?new=1',
    );

    // The other panels say plainly what fills them; no sample data anywhere.
    expect(
      await screen.findByText('Appears once there are transactions to average.'),
    ).toBeInTheDocument();
    expect(await screen.findByText('No budgets yet')).toBeInTheDocument();
    expect(
      screen.getByText('Payments appear once Montra finds repeats in your transactions.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Sample data/)).not.toBeInTheDocument();
  });

  it('opens the import flow from the empty dashboard', async () => {
    ledgerServer();
    renderTransactions('/');
    const u = userEvent.setup();

    const start = await screen.findByRole('region', { name: 'Get started' });
    await u.click(within(start).getByRole('link', { name: 'Import' }));
    expect(await screen.findByRole('dialog', { name: 'Import transactions' })).toBeInTheDocument();
  });

  it('shows a viewer the same empty layout with no actions and no dead ends', async () => {
    ledgerServer({ role: 'VIEWER' });
    renderTransactions('/');

    expect(await screen.findByText('No transactions yet.')).toBeInTheDocument();
    // In the chart panel: its description, and the note over the empty plot.
    expect(within(overview()).getAllByText('No transactions yet')).toHaveLength(2);
    expect(screen.queryByRole('link', { name: /Import/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Add transaction' })).not.toBeInTheDocument();
    expect(await screen.findByText('No budgets yet')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Set budgets' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Sample data/)).not.toBeInTheDocument();
  });

  it('speaks Bulgarian when there are no transactions', async () => {
    useUiStore.setState({ language: 'bg' });
    onTestFinished(() => {
      useUiStore.setState({ language: 'en' });
    });
    ledgerServer();
    renderTransactions('/');

    expect(
      await screen.findByText(
        'Добавете първите си транзакции, за да видите как се справя TechStore.',
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText('Все още няма бюджети')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Импорт' })).toHaveAttribute(
      'href',
      '/transactions?import=new',
    );
  });

  it('shows viewers the same figures as owners', async () => {
    ledgerServer({ role: 'VIEWER', transactions: history() });
    renderTransactions('/');
    expect(await findIn('€1,500')).toBeInTheDocument();
  });

  it('shows real zeros, not an empty state, when only the period is empty', async () => {
    useUiStore.setState({ period: { period: '7d' } });
    ledgerServer({ transactions: history().filter((t) => t.date < '2026-11-01') });
    renderTransactions('/');

    expect(await screen.findByText('No transactions in this period.')).toBeInTheDocument();
    expect(await findIn('€0')).toBeInTheDocument();
    expect(screen.queryByText('No data yet')).not.toBeInTheDocument();
    expect(screen.getByText(/Here’s how TechStore performed/)).toBeInTheDocument();
  });
});

describe('after changes', () => {
  it('recalculates when a transaction is added on the Transactions page', async () => {
    ledgerServer({ transactions: history() });
    const router = renderTransactions('/');
    const u = userEvent.setup();
    await findIn('€1,500');

    await act(() => router.navigate('/transactions'));
    await u.click(await screen.findByRole('button', { name: 'New transaction' }));
    const dialog = await screen.findByRole('dialog', { name: 'New transaction' });
    await u.click(within(dialog).getByRole('radio', { name: 'Income' }));
    await u.type(within(dialog).getByLabelText('Amount'), '250');
    await u.type(within(dialog).getByLabelText('Description'), 'Consulting');
    await u.type(within(dialog).getByLabelText(/^Category/), 'Services');
    await pickDate(u, within(dialog).getByLabelText('Date'), '2026-11-08');
    await u.click(within(dialog).getByRole('button', { name: 'Add transaction' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await act(() => router.navigate('/'));
    expect(await findIn('€1,750')).toBeInTheDocument();
  });
});
