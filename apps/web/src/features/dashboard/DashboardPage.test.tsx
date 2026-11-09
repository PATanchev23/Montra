import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetSessionForTests } from '../../api/session';
import { useToastStore } from '../../stores/toasts';
import { useUiStore } from '../../stores/ui';
import { apiError } from '../../test/authApi';
import { ledgerServer, transaction } from '../../test/ledgerApi';
import { polyfillRadix, renderTransactions } from '../../test/renderTransactions';

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

const kpi = (name: string) => screen.getByRole('region', { name });

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
      await within(await screen.findByRole('region', { name: 'Income' })).findByText('US$1,500.00'),
    ).toBeInTheDocument();
    expect(within(kpi('Income')).getByText('+US$500.00')).toBeInTheDocument();
    expect(within(kpi('Income')).getByText('50%')).toBeInTheDocument();
    expect(within(kpi('Income')).getByText(/vs\. previous 30 days/)).toBeInTheDocument();
    expect(within(kpi('Expenses')).getByText('US$400.44')).toBeInTheDocument();
    expect(within(kpi('Expenses')).getByText('−US$99.56')).toBeInTheDocument();
    expect(within(kpi('Net cash flow')).getByText('US$1,099.56')).toBeInTheDocument();
    expect(within(kpi('Net cash flow')).getByText('+US$599.56')).toBeInTheDocument();
    expect(screen.getByText(/performed in the last 30 days/)).toHaveTextContent('3 transactions');

    const breakdown = screen.getByRole('region', { name: 'Expense breakdown' });
    expect(within(breakdown).getByText('Last 30 days')).toBeInTheDocument();
    const categories = within(breakdown).getAllByRole('listitem');
    expect(categories.map((li) => li.textContent)).toEqual([
      'Advertising77.5%US$310.45',
      'Software22.5%US$89.99',
    ]);

    const recent = within(screen.getByRole('region', { name: 'Recent transactions' }));
    expect(recent.getAllByRole('listitem').map((li) => li.querySelector('p')?.textContent)).toEqual(
      ['Wholesale order', 'Website hosting', 'Facebook Ads', 'Marketplace payout', 'Office rent'],
    );

    const chart = screen.getByRole('region', { name: 'Cash flow overview' });
    expect(
      within(chart).getByText(/US\$1,500\.00 earned · US\$50\.00 daily average/),
    ).toBeInTheDocument();
    expect(api.dashboardQueries()).toEqual([{ period: '30d' }]);

    // Nothing from the sample data layer.
    expect(screen.queryByText('Montra insight')).not.toBeInTheDocument();
    expect(screen.queryByText('Upcoming payments')).not.toBeInTheDocument();
    expect(screen.queryByText('Scenario preview')).not.toBeInTheDocument();
    expect(screen.queryByText(/TechStore performed/)).toBeInTheDocument();
  });

  it('reloads for another reporting period', async () => {
    const api = ledgerServer({ transactions: history() });
    renderTransactions('/');
    const u = userEvent.setup();
    await within(await screen.findByRole('region', { name: 'Income' })).findByText('€1,500.00');

    await u.click(screen.getByRole('combobox', { name: 'Reporting period' }));
    await u.click(await screen.findByRole('option', { name: 'Last month' }));

    await waitFor(() => expect(within(kpi('Income')).getByText('€1,000.00')).toBeInTheDocument());
    expect(api.dashboardQueries().at(-1)).toEqual({ period: 'last-month' });
    expect(within(kpi('Expenses')).getByText('€310.45')).toBeInTheDocument();
    expect(within(kpi('Expenses')).getByText(/vs\. September/)).toBeInTheDocument();
    expect(screen.getByText(/performed in October 2026/)).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Expense breakdown' })).getByText('October 2026'),
    ).toBeInTheDocument();
  });

  it('takes a custom range, refusing one that runs backwards', async () => {
    const api = ledgerServer({ transactions: history() });
    renderTransactions('/');
    const u = userEvent.setup();
    await within(await screen.findByRole('region', { name: 'Income' })).findByText('€1,500.00');

    await u.click(screen.getByRole('combobox', { name: 'Reporting period' }));
    await u.click(await screen.findByRole('option', { name: 'Custom range' }));
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
      await within(await screen.findByRole('region', { name: 'Income' })).findByText('€1,500.00'),
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
      await within(await screen.findByRole('region', { name: 'Income' })).findByText('€1,500.00'),
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
    await within(await screen.findByRole('region', { name: 'Income' })).findByText('€1,500.00');

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
