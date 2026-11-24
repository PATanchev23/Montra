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

/** The capsule chart's panel, whose summary line carries the period's income ("€1,500.00 earned"). */
const overview = () => screen.getByRole('region', { name: 'Cash flow overview' });
/** The expense breakdown panel, whose ring centre carries the period's expenses. */
const breakdown = () => screen.getByRole('region', { name: 'Expense breakdown' });
/** Waits for the period's income, as the capsule chart's summary states it. */
const findEarned = async (amount: string) =>
  within(await screen.findByRole('region', { name: 'Cash flow overview' })).findByText(
    new RegExp(`^${amount.replace(/[$.]/g, '\\$&')} earned`),
  );

beforeAll(polyfillRadix);
beforeEach(() => {
  resetSessionForTests();
  useToastStore.setState({ toasts: [] });
  useUiStore.setState({ period: { period: '30d' } });
});
afterEach(() => resetSessionForTests());

describe('dashboard figures', () => {
  it('shows the period’s totals, comparison, breakdown and latest transactions from the API', async () => {
    const api = ledgerServer({ transactions: history(), currency: 'USD' });
    renderTransactions('/');

    expect(await findEarned('US$1,500.00')).toBeInTheDocument();
    expect(within(breakdown()).getByText('US$400.44')).toBeInTheDocument();
    // The period's totals are the chart's and the ring's; there are no summary tiles.
    expect(screen.queryByRole('group', { name: 'Net cash flow' })).not.toBeInTheDocument();
    expect(screen.getByText(/TechStore performed in the last 30 days/)).toBeInTheDocument();
    expect(screen.getByText(/11 Oct – 9 Nov 2026 · 3 transactions/)).toBeInTheDocument();

    const allocation = screen.getByRole('region', { name: 'Expense breakdown' });
    expect(within(allocation).getByText('Last 30 days')).toBeInTheDocument();
    const categories = within(allocation).getAllByRole('listitem');
    expect(categories.map((row) => row.textContent)).toEqual([
      'Advertising77.5%US$310.45',
      'Software22.5%US$89.99',
    ]);
    // Each category drills into its expenses over exactly this period.
    expect(within(allocation).getByRole('link', { name: 'Advertising' })).toHaveAttribute(
      'href',
      '/transactions?category=Advertising&type=expense&range=custom&from=2026-10-11&to=2026-11-09',
    );

    const recent = within(screen.getByRole('region', { name: 'Recent transactions' }));
    expect(recent.getAllByRole('listitem').map((li) => li.querySelector('p')?.textContent)).toEqual(
      ['Wholesale order', 'Website hosting', 'Facebook Ads', 'Marketplace payout', 'Office rent'],
    );

    const chart = overview();
    expect(
      within(chart).getByText(/US\$1,500\.00 earned · US\$50\.00 daily average/),
    ).toBeInTheDocument();
    // The chart's data is also there as a table, for screen readers.
    expect(
      within(chart).getByRole('table', { name: 'Income by day, Last 30 days' }),
    ).toBeInTheDocument();
    expect(api.dashboardQueries()).toEqual([{ period: '30d' }]);

    expect(
      screen.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening), / }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Montra insight')).not.toBeInTheDocument();
  });

  it('fills the forward-looking panels from the business’s own transactions', async () => {
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
    });
    renderTransactions('/');

    const upcoming = await screen.findByRole('region', { name: 'Upcoming payments' });
    expect(await within(upcoming).findByText('Shop rent')).toBeInTheDocument();
    expect(
      within(upcoming).getByText('Recurring payments from your transactions'),
    ).toBeInTheDocument();
    const scenario = screen.getByRole('region', { name: 'Scenario preview' });
    // Its largest cost at its own dearest month: September's rent ran 42% above usual.
    expect(await within(scenario).findByText('Rent costs rise')).toBeInTheDocument();
    expect(
      within(scenario).getByText(
        'Rent is your largest cost. In September it ran 42% above usual. What if every month cost that much?',
      ),
    ).toBeInTheDocument();
    expect(within(scenario).getByRole('link', { name: 'Run simulation' })).toHaveAttribute(
      'href',
      '/simulations?scenario=top-cost-up',
    );
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
    await findEarned('€1,500.00');

    await u.click(screen.getByRole('button', { name: 'Reporting period: Last 30 days' }));
    await u.click(await screen.findByRole('menuitemradio', { name: /Last month/ }));

    expect(await findEarned('€1,000.00')).toBeInTheDocument();
    expect(api.dashboardQueries().at(-1)).toEqual({ period: 'last-month' });
    expect(within(breakdown()).getAllByText('€310.45').length).toBeGreaterThan(0);
    expect(screen.getByText(/TechStore performed in October 2026/)).toBeInTheDocument();
    expect(screen.getByText(/1 – 31 Oct 2026 · 2 transactions/)).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Expense breakdown' })).getByText('October 2026'),
    ).toBeInTheDocument();
  });

  it('switches between the quick periods in one tap', async () => {
    const api = ledgerServer({ transactions: history() });
    renderTransactions('/');
    const u = userEvent.setup();
    await findEarned('€1,500.00');
    expect(screen.getByRole('radio', { name: '30 days' })).toBeChecked();

    await u.click(screen.getByRole('radio', { name: '90 days' }));

    expect(await findEarned('€2,500.00')).toBeInTheDocument();
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
    await findEarned('€1,500.00');

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
    expect(await findEarned('€2,500.00')).toBeInTheDocument();
    expect(within(breakdown()).getAllByText('€900.44').length).toBeGreaterThan(0);
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
    expect(await findEarned('€1,500.00')).toBeInTheDocument();
  });

  it('keeps the layout for a business with no transactions, inviting the owner to start', async () => {
    ledgerServer();
    renderTransactions('/');

    expect(
      await screen.findByText('Add your first transactions to see how TechStore is doing.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/0 transactions/)).toBeInTheDocument();

    // No change or percentage to misread anywhere.
    expect(screen.queryByText(/vs\. previous/)).not.toBeInTheDocument();

    // The chart stays, readable by keyboard and screen reader, behind a note and an Import button.
    expect(
      screen.getByText('Add your first transactions to see your daily cash flow'),
    ).toBeInTheDocument();
    expect(
      within(overview()).getByRole('table', { name: 'Income by day, Last 30 days' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Import transactions' })).toHaveAttribute(
      'href',
      '/transactions?import=new',
    );
    expect(screen.getByRole('link', { name: 'Import' })).toHaveAttribute(
      'href',
      '/transactions?import=new',
    );
    expect(screen.getByRole('link', { name: 'Add transaction' })).toHaveAttribute(
      'href',
      '/transactions?new=1',
    );

    // An empty ring with no legend, and no sample data anywhere.
    expect(screen.getByText('No expenses yet')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Expense categories' })).not.toBeInTheDocument();
    expect(
      screen.getByText('Payments due in the next 30 days will appear here.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Sample data/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Run simulation' })).not.toBeInTheDocument();
  });

  it('opens the import flow from the empty dashboard', async () => {
    ledgerServer();
    renderTransactions('/');
    const u = userEvent.setup();

    await u.click(await screen.findByRole('link', { name: 'Import' }));
    expect(await screen.findByRole('dialog', { name: 'Import transactions' })).toBeInTheDocument();
  });

  it('shows a viewer the same empty layout with no actions and no dead ends', async () => {
    ledgerServer({ role: 'VIEWER' });
    renderTransactions('/');

    expect(await screen.findByText('No transactions yet.')).toBeInTheDocument();
    // In the chart panel: its description, and the note over the empty tracks.
    expect(within(overview()).getAllByText('No transactions yet')).toHaveLength(2);
    expect(screen.queryByRole('link', { name: /Import/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Add transaction' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View all transactions' })).not.toBeInTheDocument();
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
    expect(screen.getByText('Все още няма разходи')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Импорт' })).toHaveAttribute(
      'href',
      '/transactions?import=new',
    );
  });

  it('shows viewers the same figures as owners', async () => {
    ledgerServer({ role: 'VIEWER', transactions: history() });
    renderTransactions('/');
    expect(await findEarned('€1,500.00')).toBeInTheDocument();
  });

  it('shows real zeros, not an empty state, when only the period is empty', async () => {
    useUiStore.setState({ period: { period: '7d' } });
    ledgerServer({ transactions: history().filter((t) => t.date < '2026-11-01') });
    renderTransactions('/');

    expect(await screen.findByText('No transactions in this period.')).toBeInTheDocument();
    expect(screen.getByText('No expenses in this period.')).toBeInTheDocument();
    expect(await findEarned('€0.00')).toBeInTheDocument();
    expect(screen.queryByText('No data yet')).not.toBeInTheDocument();
    expect(screen.getByText(/Here’s how TechStore performed/)).toBeInTheDocument();
  });
});

describe('after changes', () => {
  it('recalculates when a transaction is added on the Transactions page', async () => {
    ledgerServer({ transactions: history() });
    const router = renderTransactions('/');
    const u = userEvent.setup();
    await findEarned('€1,500.00');

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
    expect(await findEarned('€1,750.00')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Recent transactions' })).getByText('Consulting'),
    ).toBeInTheDocument();
  });
});
