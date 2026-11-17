import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { resetSessionForTests } from '../../api/session';
import { useToastStore } from '../../stores/toasts';
import { useUiStore } from '../../stores/ui';
import { apiError } from '../../test/authApi';
import { ledgerServer, transaction } from '../../test/ledgerApi';
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

/** A summary tile: net cash flow, income or expenses. */
const kpi = (name: string) => screen.getByRole('group', { name });

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

    expect(
      await within(await screen.findByRole('group', { name: 'Income' })).findByText('US$1,500.00'),
    ).toBeInTheDocument();
    expect(within(kpi('Income')).getByText('+US$500.00')).toBeInTheDocument();
    expect(within(kpi('Income')).getByText('50%')).toBeInTheDocument();
    expect(within(kpi('Income')).getByText(/vs\. previous 30 days/)).toBeInTheDocument();
    expect(within(kpi('Expenses')).getByText('US$400.44')).toBeInTheDocument();
    expect(within(kpi('Expenses')).getByText('−US$99.56')).toBeInTheDocument();
    expect(within(kpi('Net cash flow')).getByText('US$1,099.56')).toBeInTheDocument();
    expect(within(kpi('Net cash flow')).getByText('+US$599.56')).toBeInTheDocument();
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

    const chart = screen.getByRole('region', { name: 'Cash flow overview' });
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

  it('labels the two forward-looking panels as sample data, and nothing else', async () => {
    ledgerServer({ transactions: history() });
    renderTransactions('/');

    // Scheduled payments and scenarios are not served by the API yet.
    const upcoming = await screen.findByRole('region', { name: 'Upcoming payments' });
    expect(within(upcoming).getByText('Sample data · as of 25 Oct')).toBeInTheDocument();
    // Its dates are the sample layer's own, so none is called "Today" or "Tomorrow".
    expect(within(upcoming).queryByText(/Today|Tomorrow|Yesterday/)).not.toBeInTheDocument();
    expect(await within(upcoming).findAllByRole('listitem')).not.toHaveLength(0);
    const scenario = screen.getByRole('region', { name: 'Scenario preview' });
    expect(within(scenario).getByText('Sample data · as of 25 Oct')).toBeInTheDocument();
    expect(await within(scenario).findByRole('link', { name: 'Run simulation' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/simulations\?scenario=/),
    );
    // Everything fed by the API stays unmarked.
    expect(screen.getAllByText(/^Sample data/)).toHaveLength(2);
  });

  it('reloads for another reporting period', async () => {
    const api = ledgerServer({ transactions: history() });
    renderTransactions('/', <PeriodPicker />);
    const u = userEvent.setup();
    await within(await screen.findByRole('group', { name: 'Income' })).findByText('€1,500.00');

    await u.click(screen.getByRole('button', { name: 'Reporting period: Last 30 days' }));
    await u.click(await screen.findByRole('menuitemradio', { name: /Last month/ }));

    await waitFor(() => expect(within(kpi('Income')).getByText('€1,000.00')).toBeInTheDocument());
    expect(api.dashboardQueries().at(-1)).toEqual({ period: 'last-month' });
    expect(within(kpi('Expenses')).getByText('€310.45')).toBeInTheDocument();
    expect(within(kpi('Expenses')).getByText(/vs\. September/)).toBeInTheDocument();
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
    await within(await screen.findByRole('group', { name: 'Income' })).findByText('€1,500.00');
    expect(screen.getByRole('radio', { name: '30 days' })).toBeChecked();

    await u.click(screen.getByRole('radio', { name: '90 days' }));

    await waitFor(() => expect(within(kpi('Income')).getByText('€2,500.00')).toBeInTheDocument());
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
    await within(await screen.findByRole('group', { name: 'Income' })).findByText('€1,500.00');

    await u.click(screen.getByRole('button', { name: 'Reporting period: Last 30 days' }));
    await u.click(await screen.findByRole('menuitemradio', { name: /Custom range/ }));
    // It starts from the dates that were on screen.
    expect(screen.getByLabelText('From date')).toHaveValue('2026-10-11');
    expect(screen.getByLabelText('To date')).toHaveValue('2026-11-09');

    const before = api.dashboardQueries().length;
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-12-01' } });
    expect(await screen.findByText('Check the date range')).toBeInTheDocument();
    expect(screen.getByText('The start date is after the end date.')).toBeInTheDocument();
    expect(
      api
        .dashboardQueries()
        .slice(before)
        .every((q) => q.from !== '2026-12-01'),
    ).toBe(true);

    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-09-01' } });
    await waitFor(() =>
      expect(api.dashboardQueries().at(-1)).toEqual({
        period: 'custom',
        from: '2026-09-01',
        to: '2026-11-09',
      }),
    );
    expect(await within(kpi('Income')).findByText('€2,500.00')).toBeInTheDocument();
    expect(within(kpi('Expenses')).getByText('€900.44')).toBeInTheDocument();
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
    expect(
      await within(await screen.findByRole('group', { name: 'Income' })).findByText('€1,500.00'),
    ).toBeInTheDocument();
  });

  it('invites the owner to add transactions when there are none', async () => {
    ledgerServer();
    renderTransactions('/');

    expect(await screen.findByText('No transactions yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add or import transactions' })).toHaveAttribute(
      'href',
      '/transactions',
    );
  });

  it('tells a viewer that the owner has not recorded anything yet', async () => {
    ledgerServer({ role: 'VIEWER' });
    renderTransactions('/');

    expect(
      await screen.findByText(
        'The dashboard fills in once the business owner records transactions.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Add or import transactions' }),
    ).not.toBeInTheDocument();
  });

  it('shows viewers the same figures as owners', async () => {
    ledgerServer({ role: 'VIEWER', transactions: history() });
    renderTransactions('/');
    expect(
      await within(await screen.findByRole('group', { name: 'Income' })).findByText('€1,500.00'),
    ).toBeInTheDocument();
  });

  it('says so when a period has no transactions', async () => {
    useUiStore.setState({ period: { period: '7d' } });
    ledgerServer({ transactions: history().filter((t) => t.date < '2026-11-01') });
    renderTransactions('/');

    expect(await screen.findByText('No transactions in this period.')).toBeInTheDocument();
    expect(screen.getByText('No expenses in this period.')).toBeInTheDocument();
    expect(within(kpi('Income')).getAllByText('€0.00')).toHaveLength(2);
  });
});

describe('after changes', () => {
  it('recalculates when a transaction is added on the Transactions page', async () => {
    ledgerServer({ transactions: history() });
    const router = renderTransactions('/');
    const u = userEvent.setup();
    await within(await screen.findByRole('group', { name: 'Income' })).findByText('€1,500.00');

    await act(() => router.navigate('/transactions'));
    await u.click(await screen.findByRole('button', { name: 'New transaction' }));
    const dialog = await screen.findByRole('dialog', { name: 'New transaction' });
    await u.click(within(dialog).getByRole('radio', { name: 'Income' }));
    await u.type(within(dialog).getByLabelText('Amount'), '250');
    await u.type(within(dialog).getByLabelText('Description'), 'Consulting');
    await u.type(within(dialog).getByLabelText(/^Category/), 'Services');
    fireEvent.change(within(dialog).getByLabelText('Date'), { target: { value: '2026-11-08' } });
    await u.click(within(dialog).getByRole('button', { name: 'Add transaction' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await act(() => router.navigate('/'));
    expect(await within(kpi('Income')).findByText('€1,750.00')).toBeInTheDocument();
    expect(within(kpi('Net cash flow')).getByText('€1,349.56')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Recent transactions' })).getByText('Consulting'),
    ).toBeInTheDocument();
  });
});
