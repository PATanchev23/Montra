import type { ImportBatch, ImportDetail, ImportEntry } from '@montra/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetSessionForTests } from '../../api/session';
import { useToastStore } from '../../stores/toasts';
import { apiError } from '../../test/authApi';
import { ledgerServer, transaction } from '../../test/ledgerApi';
import { polyfillRadix, renderTransactions } from '../../test/renderTransactions';

const batch = (overrides: Partial<ImportBatch> = {}): ImportBatch => ({
  id: 'imp-1',
  source: 'GENERIC_CSV',
  fileFormat: 'CSV',
  fileName: 'statement.csv',
  fileSize: 240,
  status: 'AWAITING_MAPPING',
  totalRecords: 0,
  importedRecords: 0,
  skippedRecords: 0,
  failedRecords: 0,
  createdAt: '2026-11-09T09:00:00.000Z',
  completedAt: null,
  expiresAt: '2026-11-10T09:00:00.000Z',
  ...overrides,
});

const columns = ['Дата', 'Описание', 'Сума', 'Референция'];
const sampleRows = [
  ['01.10.2026', 'Плащане от клиент', '1 250,00', 'TX-1001'],
  ['02.10.2026', 'Facebook Ads', '-310,45', 'TX-1002'],
];

/** A bank statement without amount or category mapped yet. */
const awaitingMapping = (): ImportDetail => ({
  batch: batch(),
  columns,
  sampleRows,
  mapping: { columns: { date: 0, description: 1, externalId: 3 }, dateFormat: 'DMY' },
  missing: ['amount', 'category'],
  preview: null,
  previousImportId: null,
  notices: ['Dates are read day first: 05.10.2026 is 5 October 2026.'],
});

const entry = (index: number, overrides: Partial<ImportEntry>): ImportEntry => ({
  index,
  row: index + 2,
  status: 'VALID',
  transaction: {
    type: 'EXPENSE',
    amountCents: 1000,
    description: `Record ${index}`,
    category: 'Bank',
    date: '2026-10-01',
    externalId: null,
  },
  issues: [],
  notes: [],
  duplicateOf: null,
  cells: null,
  ...overrides,
});

const entries: ImportEntry[] = [
  entry(0, {
    transaction: {
      type: 'INCOME',
      amountCents: 125_000,
      description: 'Плащане от клиент',
      category: 'Bank',
      date: '2026-10-01',
      externalId: 'TX-1001',
    },
  }),
  entry(1, {
    transaction: {
      type: 'EXPENSE',
      amountCents: 31_045,
      description: 'Facebook Ads',
      category: 'Bank',
      date: '2026-10-02',
      externalId: 'TX-1002',
    },
  }),
  entry(2, {
    status: 'INVALID',
    transaction: null,
    issues: [{ field: 'amount', message: '“abc” is not an amount.' }],
    cells: ['13.10.2026', 'Наем офис', 'abc', 'TX-1003'],
  }),
  entry(3, {
    status: 'DUPLICATE',
    notes: ['Already imported (id TX-1004).'],
    duplicateOf: 't9',
  }),
  entry(4, {
    status: 'POSSIBLE_DUPLICATE',
    transaction: {
      type: 'EXPENSE',
      amountCents: 4_280,
      description: 'Куриерски услуги',
      category: 'Bank',
      date: '2026-10-14',
      externalId: null,
    },
    notes: ['A transaction with the same date, type, amount and description already exists.'],
    duplicateOf: 't2',
  }),
];

/** The same statement once amount and a default category are mapped. */
const ready = (): ImportDetail => ({
  ...awaitingMapping(),
  batch: batch({ status: 'READY', totalRecords: 5 }),
  mapping: {
    columns: { date: 0, description: 1, amount: 2, externalId: 3 },
    dateFormat: 'DMY',
    decimalSeparator: ',',
    defaultCategory: 'Bank',
  },
  missing: [],
  preview: {
    summary: { total: 5, valid: 2, invalid: 1, duplicates: 1, possibleDuplicates: 1 },
    entries,
  },
});

const toastTitles = () => useToastStore.getState().toasts.map((toast) => toast.title);

beforeAll(polyfillRadix);
beforeEach(() => {
  resetSessionForTests();
  useToastStore.setState({ toasts: [] });
});
afterEach(() => resetSessionForTests());

describe('importing a file', () => {
  it('uploads a CSV, maps its columns, reviews every record and confirms', async () => {
    const api = ledgerServer({
      onUpload: () => awaitingMapping(),
      onMapping: () => ready(),
    });
    renderTransactions();
    const u = userEvent.setup();

    await u.click(await screen.findByRole('button', { name: 'Import' }));
    const upload = await screen.findByRole('dialog', { name: 'Import transactions' });
    const file = new File(['Дата;Описание;Сума\n'], 'statement.csv', { type: 'text/csv' });
    await u.upload(within(upload).getByLabelText('File to import'), file);
    expect(within(upload).getByText('statement.csv')).toBeInTheDocument();
    await u.click(within(upload).getByRole('button', { name: 'Upload and preview' }));

    // The file itself is the body, labelled by its name.
    const [, init] = api.fetchMock.mock.calls.find(
      ([input, i]) => i?.method === 'POST' && String(input).includes('/imports?'),
    )!;
    expect(api.requests()).toContain(
      'POST /api/v1/businesses/biz-1/imports?source=GENERIC_CSV&fileName=statement.csv',
    );
    expect(init!.body).toBe(file);
    expect((init!.headers as Record<string, string>)['Content-Type']).toBe('text/csv');

    const sheet = await screen.findByRole('dialog', { name: 'statement.csv' });
    expect(within(sheet).getByText('Needs mapping')).toBeInTheDocument();
    expect(within(sheet).getByText('Choose the column with the amounts.')).toBeInTheDocument();
    expect(
      within(sheet).getByText('Choose a category column, or set a default category.'),
    ).toBeInTheDocument();
    expect(within(sheet).getByText(/Dates are read day first/)).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Import 0 transactions' })).toBeDisabled();

    await u.click(within(sheet).getByRole('combobox', { name: 'Amount column' }));
    await u.click(await screen.findByRole('option', { name: 'Сума — e.g. 1 250,00' }));
    await u.type(within(sheet).getByLabelText('Default category'), 'Bank');
    await u.click(within(sheet).getByRole('button', { name: 'Update preview' }));

    await within(sheet).findByText('Ready to review');
    expect(api.bodies('PUT', /\/mapping$/)).toEqual([
      {
        mapping: {
          columns: { date: 0, description: 1, amount: 2, externalId: 3 },
          dateFormat: 'DMY',
          defaultCategory: 'Bank',
        },
      },
    ]);

    // Invalid records come first, with the reason and the original cells.
    const preview = within(sheet).getByRole('region', { name: 'Preview' });
    expect(within(preview).getByText('To import').nextSibling).toHaveTextContent('2');
    expect(within(preview).getByText('To skip').nextSibling).toHaveTextContent('2');
    expect(within(preview).getByText('Invalid', { selector: 'p' }).nextSibling).toHaveTextContent(
      '1',
    );
    expect(within(preview).getByText('“abc” is not an amount.')).toBeInTheDocument();
    expect(within(preview).getByText('13.10.2026 | Наем офис | abc | TX-1003')).toBeInTheDocument();

    await u.click(within(preview).getByRole('radio', { name: 'Valid 2' }));
    expect(within(preview).getByText('Facebook Ads')).toBeInTheDocument();
    expect(within(preview).getByText('+€1,250.00')).toBeInTheDocument();
    await u.click(within(preview).getByRole('radio', { name: 'Duplicates 1' }));
    expect(within(preview).getByText('Already imported (id TX-1004).')).toBeInTheDocument();

    await u.click(within(preview).getByRole('radio', { name: 'Possible duplicates 1' }));
    await u.click(within(preview).getByRole('checkbox', { name: 'Import anyway' }));
    expect(within(preview).getByText('To import').nextSibling).toHaveTextContent('3');

    expect(api.bodies('POST', /\/confirm$/)).toHaveLength(0);
    await u.click(within(sheet).getByRole('button', { name: 'Import 3 transactions' }));

    expect(
      await within(sheet).findByText(/3 transactions added to your history/),
    ).toBeInTheDocument();
    expect(within(sheet).getByText('Imported', { selector: 'p' }).nextSibling).toHaveTextContent(
      '3',
    );
    expect(api.bodies('POST', /\/confirm$/)).toEqual([{ includePossibleDuplicates: [4] }]);
    expect(within(sheet).getByText(/3 transactions added to your history/)).toBeInTheDocument();
    expect(within(sheet).getByText(/1 invalid record was left out/)).toBeInTheDocument();
    expect(toastTitles()).toContain('Imported 3 transactions');

    await u.click(within(sheet).getByRole('button', { name: 'Done' }));
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Куриерски услуги')).toBeInTheDocument();
    expect(within(table).getByText('Facebook Ads')).toBeInTheDocument();
    expect(within(table).getAllByText('CSV file')).toHaveLength(3);
    expect(screen.getByRole('region', { name: 'Imports' })).toHaveTextContent(
      /statement\.csv.*3 imported · 1 skipped · 1 invalid/,
    );
  });

  it('cancels a pending import from the history, after confirmation', async () => {
    const api = ledgerServer({ imports: [ready()] });
    renderTransactions();
    const u = userEvent.setup();

    const history = await screen.findByRole('region', { name: 'Imports' });
    expect(within(history).getByText(/1 waiting for review/)).toBeInTheDocument();
    await u.click(within(history).getByRole('button', { name: /Review/ }));
    const sheet = await screen.findByRole('dialog', { name: 'statement.csv' });

    await u.click(within(sheet).getByRole('button', { name: 'Cancel import' }));
    let confirm = await screen.findByRole('alertdialog', { name: 'Cancel this import?' });
    await u.click(within(confirm).getByRole('button', { name: 'Keep reviewing' }));
    expect(api.requests().some((r) => r.startsWith('DELETE'))).toBe(false);

    await u.click(within(sheet).getByRole('button', { name: 'Cancel import' }));
    confirm = await screen.findByRole('alertdialog', { name: 'Cancel this import?' });
    await u.click(within(confirm).getByRole('button', { name: 'Cancel import' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.requests()).toContain('DELETE /api/v1/businesses/biz-1/imports/imp-1');
    expect(toastTitles()).toContain('Import cancelled');
    expect(await within(history).findByText('Cancelled')).toBeInTheDocument();
    expect(api.state.transactions).toHaveLength(0);
  });

  it('removes a finished import with its transactions, after confirmation', async () => {
    const completed: ImportDetail = {
      ...ready(),
      batch: batch({
        status: 'COMPLETED',
        totalRecords: 2,
        importedRecords: 2,
        completedAt: '2026-11-09T09:05:00.000Z',
        expiresAt: null,
      }),
      preview: null,
    };
    const fromFile = (id: string) =>
      transaction({
        id,
        description: `From file ${id}`,
        importSource: 'GENERIC_CSV',
        importBatchId: 'imp-1',
      });
    const api = ledgerServer({
      imports: [completed],
      transactions: [
        fromFile('f1'),
        fromFile('f2'),
        transaction({ id: 'h1', description: 'Entered by hand' }),
      ],
    });
    renderTransactions();
    const u = userEvent.setup();

    const history = await screen.findByRole('region', { name: 'Imports' });
    await u.click(within(history).getByRole('button', { name: 'Remove statement.csv' }));
    let confirm = await screen.findByRole('alertdialog', { name: 'Remove this import?' });
    expect(confirm).toHaveTextContent(
      'statement.csv and the 2 transactions it added will be deleted',
    );
    await u.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(api.requests().some((r) => r.startsWith('DELETE'))).toBe(false);

    await u.click(within(history).getByRole('button', { name: 'Remove statement.csv' }));
    confirm = await screen.findByRole('alertdialog', { name: 'Remove this import?' });
    await u.click(within(confirm).getByRole('button', { name: 'Remove import' }));

    await waitFor(() =>
      expect(toastTitles()).toContain('Removed statement.csv and 2 transactions'),
    );
    expect(api.requests()).toContain('DELETE /api/v1/businesses/biz-1/imports/imp-1/transactions');
    expect(api.state.transactions.map((t) => t.id)).toEqual(['h1']);
    // The list of transactions and the history both refresh.
    await waitFor(() => expect(screen.queryByText('From file f1')).not.toBeInTheDocument());
    expect(screen.getByText('Entered by hand')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Imports' })).not.toBeInTheDocument(),
    );
  });

  it('offers no way to remove an import to a viewer', async () => {
    ledgerServer({ imports: [ready()], role: 'VIEWER' });
    renderTransactions();

    const history = await screen.findByRole('region', { name: 'Imports' });
    expect(within(history).queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument();
  });

  it('refuses unsupported files before uploading, and shows the API’s reasons', async () => {
    const api = ledgerServer({
      onUpload: () =>
        apiError(
          422,
          'IMPORT_COLUMNS_MISSING',
          'This is not the Montra template. Missing columns: Type, Category.',
        ),
    });
    renderTransactions();
    const u = userEvent.setup({ applyAccept: false });

    await u.click(await screen.findByRole('button', { name: 'Import' }));
    const sheet = await screen.findByRole('dialog', { name: 'Import transactions' });
    await u.upload(
      within(sheet).getByLabelText('File to import'),
      new File(['%PDF'], 'report.pdf'),
    );
    expect(within(sheet).getByText(/Choose a \.csv or \.xlsx file/)).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Upload and preview' })).toBeDisabled();

    await u.click(within(sheet).getByRole('radio', { name: /The Montra template/ }));
    await u.upload(
      within(sheet).getByLabelText('File to import'),
      new File(['Date,Amount\n'], 'October.csv', { type: 'text/csv' }),
    );
    await u.click(within(sheet).getByRole('button', { name: 'Upload and preview' }));

    expect(
      await within(sheet).findByText(/This is not the Montra template. Missing columns/),
    ).toBeInTheDocument();
    expect(
      within(sheet).getByText(/choose “A CSV or Excel file” and map its columns/),
    ).toBeInTheDocument();
    expect(api.requests()).toContain(
      'POST /api/v1/businesses/biz-1/imports?source=MONTRA_TEMPLATE&fileName=October.csv',
    );
  });
});

describe('viewers and imports', () => {
  it('can open an import’s preview but not change, confirm or cancel it', async () => {
    const api = ledgerServer({ role: 'VIEWER', imports: [ready()] });
    renderTransactions();
    const u = userEvent.setup();

    const history = await screen.findByRole('region', { name: 'Imports' });
    expect(
      within(history).getByText(/Nothing is saved until the owner confirms/),
    ).toBeInTheDocument();
    await u.click(within(history).getByRole('button', { name: /View/ }));
    const sheet = await screen.findByRole('dialog', { name: 'statement.csv' });

    expect(within(sheet).getByText('“abc” is not an amount.')).toBeInTheDocument();
    expect(within(sheet).getByRole('combobox', { name: 'Amount column' })).toBeDisabled();
    expect(
      within(sheet).getByText(/View only. The business owner reviews and confirms/),
    ).toBeInTheDocument();
    expect(within(sheet).queryByRole('button', { name: /^Import \d/ })).not.toBeInTheDocument();
    expect(within(sheet).queryByRole('button', { name: 'Cancel import' })).not.toBeInTheDocument();
    await u.click(within(sheet).getByRole('radio', { name: 'Possible duplicates 1' }));
    expect(within(sheet).queryByRole('checkbox')).not.toBeInTheDocument();
    expect(api.requests().filter((r) => !r.startsWith('GET') && !r.includes('/auth/'))).toEqual([]);
  });
});
