import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetSessionForTests } from '../../api/session';
import { useToastStore } from '../../stores/toasts';
import { apiError } from '../../test/authApi';
import { ledgerServer, transaction } from '../../test/ledgerApi';
import { polyfillRadix, renderTransactions } from '../../test/renderTransactions';

const history = () => [
  transaction({
    id: 't1',
    type: 'INCOME',
    amountCents: 150_000,
    description: 'Wholesale order',
    category: 'Sales',
    date: '2026-10-05',
  }),
  transaction({
    id: 't2',
    type: 'EXPENSE',
    amountCents: 8_999,
    description: 'Website hosting',
    category: 'Software',
    date: '2026-10-04',
  }),
  transaction({
    id: 't3',
    type: 'EXPENSE',
    amountCents: 31_045,
    description: 'Facebook Ads',
    category: 'Advertising',
    date: '2026-10-04',
    importSource: 'GENERIC_CSV',
    importBatchId: 'imp-0',
    externalId: 'TX-1002',
  }),
];

const user = () => userEvent.setup();
const lastQuery = (api: ReturnType<typeof ledgerServer>) => api.listQueries().at(-1);
const toastTitles = () => useToastStore.getState().toasts.map((toast) => toast.title);

beforeAll(polyfillRadix);
beforeEach(() => {
  resetSessionForTests();
  useToastStore.setState({ toasts: [] });
});
afterEach(() => resetSessionForTests());

describe('transaction history', () => {
  it('shows the business’s transactions from the API, in its currency', async () => {
    const api = ledgerServer({ transactions: history(), currency: 'USD' });
    renderTransactions();

    const table = await screen.findByRole('table');
    const sale = within(table).getByRole('row', { name: /^Wholesale order, Income, Sales/ });
    expect(within(sale).getByText('+US$1,500.00')).toBeInTheDocument();
    const ads = within(table).getByRole('row', { name: /^Facebook Ads, Expense, Advertising/ });
    expect(within(ads).getByText('−US$310.45')).toBeInTheDocument();
    expect(within(ads).getByText('CSV file')).toBeInTheDocument();
    // Grouped by day, newest first, with each day's net.
    expect(within(table).getByText('· 4 October 2026')).toBeInTheDocument();
    expect(within(table).getByText('−US$400.44')).toBeInTheDocument();
    expect(screen.getByText(/Every payment in and out of TechStore, in USD/)).toBeInTheDocument();
    expect(lastQuery(api)).toEqual({ page: '1', pageSize: '25', sort: 'date_desc' });
  });

  it('invites the owner to add or import when there is nothing yet', async () => {
    ledgerServer();
    renderTransactions();

    expect(await screen.findByText('No transactions yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import a file' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'New transaction' })).toHaveLength(2);
  });

  it('shows an error with a way to try again', async () => {
    const api = ledgerServer({ transactions: history() });
    api.state.override = (method, url) =>
      method === 'GET' && url.pathname.endsWith('/transactions')
        ? apiError(404, 'NOT_FOUND', 'Business not found.')
        : undefined;
    renderTransactions();

    expect(await screen.findByText('Business not found.')).toBeInTheDocument();
    api.state.override = null;
    await user().click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('applies filters from the URL', async () => {
    const api = ledgerServer({ transactions: history() });
    renderTransactions('/transactions?type=expense&category=software');

    const table = await screen.findByRole('table');
    expect(within(table).getByText('Website hosting')).toBeInTheDocument();
    expect(within(table).queryByText('Facebook Ads')).not.toBeInTheDocument();
    expect(lastQuery(api)).toMatchObject({ type: 'EXPENSE', category: 'software' });
    expect(screen.getByRole('button', { name: /Software/ })).toBeInTheDocument();
  });

  it('filters by type, category and date range through the API', async () => {
    const api = ledgerServer({ transactions: history() });
    renderTransactions();
    const u = user();
    await screen.findByRole('table');

    await u.click(screen.getByRole('radio', { name: 'Income' }));
    await waitFor(() => expect(lastQuery(api)).toMatchObject({ type: 'INCOME' }));
    expect(await screen.findByText('Wholesale order')).toBeInTheDocument();
    await u.click(screen.getByRole('radio', { name: 'All' }));

    await u.click(screen.getByRole('button', { name: /All categories/ }));
    await u.click(await screen.findByRole('menuitemradio', { name: /Advertising/ }));
    await waitFor(() => expect(lastQuery(api)).toMatchObject({ category: 'Advertising' }));
    await waitFor(() => expect(screen.queryByText('Website hosting')).not.toBeInTheDocument());

    await u.click(screen.getByRole('combobox', { name: 'Date range' }));
    await u.click(await screen.findByRole('option', { name: 'Custom range' }));
    const requestsBefore = api.listQueries().length;
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-10-05' } });
    fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-10-01' } });
    expect(await screen.findByText('The start date is after the end date.')).toBeInTheDocument();
    expect(screen.getByText('Check the date range')).toBeInTheDocument();
    // A backwards range is never sent.
    expect(
      api
        .listQueries()
        .slice(requestsBefore)
        .every((q) => q.to !== '2026-10-01'),
    ).toBe(true);

    fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-10-31' } });
    await waitFor(() =>
      expect(lastQuery(api)).toMatchObject({
        category: 'Advertising',
        from: '2026-10-05',
        to: '2026-10-31',
      }),
    );
    expect(await screen.findByText('No transactions match these filters')).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Clear filters' }));
    // The unfiltered first page may come from the cache; what matters is that it is back.
    const table = await screen.findByRole('table');
    expect(
      within(table).getAllByRole('row', { name: /^(Wholesale|Website|Facebook)/ }),
    ).toHaveLength(3);
    expect(screen.queryByLabelText('From date')).not.toBeInTheDocument();
  });

  it('sorts by amount and pages through results', async () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      transaction({
        id: `t${String(i).padStart(2, '0')}`,
        amountCents: (i + 1) * 100,
        description: `Payment ${i + 1}`,
        date: `2026-09-${String((i % 28) + 1).padStart(2, '0')}`,
      }),
    );
    const api = ledgerServer({ transactions: many });
    renderTransactions();
    const u = user();

    expect(await screen.findByText('1–25')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Next page' }));
    expect(await screen.findByText('26–30')).toBeInTheDocument();
    expect(lastQuery(api)).toMatchObject({ page: '2' });

    await u.click(screen.getByRole('button', { name: /Amount/ }));
    await waitFor(() => expect(lastQuery(api)).toMatchObject({ sort: 'amount_desc', page: '1' }));
    const table = await screen.findByRole('table');
    await waitFor(() =>
      expect(within(table).getAllByRole('row')[1]).toHaveAccessibleName(/^Payment 30,/),
    );
    expect(within(table).getByRole('columnheader', { name: /Amount/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );

    await u.click(screen.getByRole('button', { name: /Amount/ }));
    await waitFor(() => expect(lastQuery(api)).toMatchObject({ sort: 'amount_asc' }));
    await waitFor(() =>
      expect(within(screen.getByRole('table')).getAllByRole('row')[1]).toHaveAccessibleName(
        /^Payment 1,/,
      ),
    );
  });
});

describe('recording and changing transactions', () => {
  it('validates and creates a transaction, then refreshes the history', async () => {
    const api = ledgerServer({ transactions: history() });
    renderTransactions();
    const u = user();
    await screen.findByRole('table');

    await u.click(screen.getByRole('button', { name: 'New transaction' }));
    const dialog = await screen.findByRole('dialog', { name: 'New transaction' });
    await u.click(within(dialog).getByRole('button', { name: 'Add transaction' }));
    expect(within(dialog).getByText('Enter an amount.')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a description.')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a category.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Amount')).toHaveFocus();

    await u.type(within(dialog).getByLabelText('Amount'), 'abc');
    expect(within(dialog).getByText('Enter an amount such as 89.99.')).toBeInTheDocument();
    expect(api.bodies('POST', /\/transactions$/)).toHaveLength(0);

    await u.click(within(dialog).getByRole('radio', { name: 'Income' }));
    await u.clear(within(dialog).getByLabelText('Amount'));
    await u.type(within(dialog).getByLabelText('Amount'), '1 250,50');
    await u.type(within(dialog).getByLabelText('Description'), 'Consulting');
    await u.type(within(dialog).getByLabelText(/^Category/), 'Services');
    fireEvent.change(within(dialog).getByLabelText('Date'), { target: { value: '2026-10-10' } });
    await u.click(within(dialog).getByRole('button', { name: 'Add transaction' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.bodies('POST', /\/transactions$/)).toEqual([
      {
        type: 'INCOME',
        amountCents: 125_050,
        description: 'Consulting',
        category: 'Services',
        date: '2026-10-10',
        currency: 'EUR',
      },
    ]);
    expect(toastTitles()).toContain('Income recorded');
    const row = await screen.findByRole('row', { name: /^Consulting, Income, Services/ });
    expect(within(row).getByText('+€1,250.50')).toBeInTheDocument();
  });

  it('edits a transaction with its values prefilled, sending only what changed', async () => {
    const api = ledgerServer({ transactions: history() });
    renderTransactions();
    const u = user();

    await u.click(await screen.findByRole('row', { name: /^Website hosting/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Transaction details' });
    expect(within(sheet).getByText('Entered by hand')).toBeInTheDocument();
    await u.click(within(sheet).getByRole('button', { name: 'Edit' }));

    const form = await screen.findByRole('dialog', { name: 'Edit transaction' });
    expect(within(form).getByLabelText('Amount')).toHaveValue('89.99');
    expect(within(form).getByLabelText('Description')).toHaveValue('Website hosting');
    expect(within(form).getByLabelText(/^Category/)).toHaveValue('Software');
    expect(within(form).getByLabelText('Date')).toHaveValue('2026-10-04');
    expect(within(form).getByRole('radio', { name: 'Expense' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(within(form).getByRole('button', { name: 'Save changes' })).toBeDisabled();

    await u.clear(within(form).getByLabelText('Amount'));
    await u.type(within(form).getByLabelText('Amount'), '95');
    await u.click(within(form).getByRole('button', { name: 'Save changes' }));

    const details = await screen.findByRole('dialog', { name: 'Transaction details' });
    expect(within(details).getByText('−€95.00')).toBeInTheDocument();
    expect(api.bodies('PATCH', /\/transactions\/t2$/)).toEqual([
      { amountCents: 9_500, currency: 'EUR' },
    ]);
    expect(toastTitles()).toContain('Transaction updated');
    await u.click(within(details).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const row = await screen.findByRole('row', { name: /^Website hosting/ });
    expect(within(row).getByText('−€95.00')).toBeInTheDocument();
  });

  it('deletes a transaction only after confirmation', async () => {
    const api = ledgerServer({ transactions: history() });
    renderTransactions();
    const u = user();

    await u.click(await screen.findByRole('row', { name: /^Facebook Ads/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Transaction details' });
    expect(within(sheet).getByText('TX-1002')).toBeInTheDocument();

    await u.click(within(sheet).getByRole('button', { name: 'Delete' }));
    let confirm = await screen.findByRole('alertdialog', { name: 'Delete this transaction?' });
    await u.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(api.requests().some((r) => r.startsWith('DELETE'))).toBe(false);

    await u.click(within(sheet).getByRole('button', { name: 'Delete' }));
    confirm = await screen.findByRole('alertdialog', { name: 'Delete this transaction?' });
    await u.click(within(confirm).getByRole('button', { name: 'Delete transaction' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.requests()).toContain('DELETE /api/v1/businesses/biz-1/transactions/t3');
    await waitFor(() =>
      expect(within(screen.getByRole('table')).queryByText('Facebook Ads')).not.toBeInTheDocument(),
    );
    expect(toastTitles()).toContain('Transaction deleted');
  });

  it('shows the API’s refusal when the server denies a change', async () => {
    const api = ledgerServer({ transactions: history() });
    renderTransactions();
    const u = user();
    await screen.findByRole('table');
    // The page still thinks this user is the owner; the API has the final say.
    api.state.refuseWrites = true;

    await u.click(screen.getByRole('row', { name: /^Website hosting/ }));
    await u.click(await screen.findByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('alertdialog');
    await u.click(within(confirm).getByRole('button', { name: 'Delete transaction' }));
    expect(
      await within(confirm).findByText('Only the business owner can make changes.'),
    ).toBeInTheDocument();
    expect(api.state.transactions).toHaveLength(3);
  });
});

describe('viewers', () => {
  it('can read the history but are offered no way to change it', async () => {
    ledgerServer({ role: 'VIEWER', transactions: history() });
    renderTransactions();
    const u = user();

    await screen.findByRole('table');
    expect(screen.getByText('View only')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New transaction' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import' })).not.toBeInTheDocument();

    await u.click(screen.getByRole('row', { name: /^Website hosting/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Transaction details' });
    expect(within(sheet).getByText(/You have view-only access/)).toBeInTheDocument();
    expect(within(sheet).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(within(sheet).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('see an empty history without owner actions', async () => {
    ledgerServer({ role: 'VIEWER' });
    renderTransactions();

    expect(
      await screen.findByText('The business owner hasn’t recorded any transactions yet.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import a file' })).not.toBeInTheDocument();
  });
});
