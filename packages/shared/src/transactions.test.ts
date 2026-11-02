import { describe, expect, it } from 'vitest';
import {
  columnMappingSchema,
  confirmImportRequestSchema,
  IMPORT_MAX_FILE_BYTES,
  MONTRA_TEMPLATE_COLUMNS,
  uploadImportQuerySchema,
} from './imports';
import {
  createTransactionRequestSchema,
  importSourceSchema,
  transactionListQuerySchema,
  updateTransactionRequestSchema,
} from './transactions';

const valid = {
  type: 'EXPENSE',
  amountCents: 8999,
  description: ' Website hosting ',
  category: ' Software ',
  date: '2026-10-02',
};

describe('transaction contracts', () => {
  it('accepts a transaction and trims its text', () => {
    expect(createTransactionRequestSchema.parse({ ...valid, currency: 'EUR' })).toEqual({
      ...valid,
      description: 'Website hosting',
      category: 'Software',
      currency: 'EUR',
    });
  });

  it('drops fields the client does not control', () => {
    expect(
      createTransactionRequestSchema.parse({ ...valid, businessId: 'x', externalId: 'y' }),
    ).not.toHaveProperty('businessId');
  });

  it.each([
    ['amountCents', 0, 'The amount must be greater than zero.'],
    ['amountCents', -1, 'The amount must be greater than zero.'],
    ['amountCents', 1.5, 'Enter the amount in whole cents.'],
    ['amountCents', 2_147_483_648, 'The amount is too large.'],
    ['type', 'income', 'Choose income or expense.'],
    ['description', ' ', 'Enter a description.'],
    ['description', 'x'.repeat(256), 'Use at most 255 characters.'],
    ['category', '', 'Enter a category.'],
    ['date', '2026-02-29', 'Enter a real date as YYYY-MM-DD.'],
    ['date', '2026-10-2', 'Enter a real date as YYYY-MM-DD.'],
    ['date', '1899-12-31', 'Enter a date between 1900 and 2199.'],
    ['currency', 'BGN', 'Choose a supported currency.'],
  ])('rejects %s = %j', (field, value, message) => {
    const result = createTransactionRequestSchema.safeParse({ ...valid, [field]: value });
    expect(result.error?.issues[0]).toMatchObject({ path: [field], message });
  });

  it('accepts a leap day', () => {
    expect(createTransactionRequestSchema.safeParse({ ...valid, date: '2028-02-29' }).success).toBe(
      true,
    );
  });

  it('updates need at least one field', () => {
    expect(updateTransactionRequestSchema.safeParse({}).success).toBe(false);
    expect(updateTransactionRequestSchema.parse({ amountCents: 1 })).toEqual({ amountCents: 1 });
  });

  it('list queries have defaults, limits and a sensible date range', () => {
    expect(transactionListQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 25,
      sort: 'date_desc',
    });
    expect(transactionListQuerySchema.parse({ page: '2', pageSize: '100' })).toMatchObject({
      page: 2,
      pageSize: 100,
    });
    expect(transactionListQuerySchema.safeParse({ pageSize: '101' }).success).toBe(false);
    expect(
      transactionListQuerySchema.safeParse({ from: '2026-10-05', to: '2026-10-01' }).success,
    ).toBe(false);
  });
});

describe('import contracts', () => {
  it('requires a known source and a file name', () => {
    expect(
      uploadImportQuerySchema.safeParse({ source: 'GENERIC_CSV', fileName: ' a.csv ' }).data,
    ).toEqual({ source: 'GENERIC_CSV', fileName: 'a.csv' });
    expect(uploadImportQuerySchema.safeParse({ source: 'GENERIC_CSV', fileName: '' }).success).toBe(
      false,
    );
  });

  it('accepts only the template and generic files as sources', () => {
    expect(importSourceSchema.options).toEqual(['MONTRA_TEMPLATE', 'GENERIC_CSV', 'GENERIC_EXCEL']);
    for (const source of ['SHOPIFY', 'WOOCOMMERCE', 'SQUARE']) {
      expect(uploadImportQuerySchema.safeParse({ source, fileName: 'a.csv' }).success).toBe(false);
    }
  });

  it('maps each column to one field at most', () => {
    expect(columnMappingSchema.safeParse({ columns: { date: 0, amount: 1 } }).success).toBe(true);
    expect(columnMappingSchema.safeParse({ columns: { date: 0, amount: 0 } }).success).toBe(false);
    expect(columnMappingSchema.safeParse({ columns: { date: -1 } }).success).toBe(false);
    expect(columnMappingSchema.safeParse({ columns: {}, defaultCategory: ' ' }).success).toBe(
      false,
    );
  });

  it('confirms with no possible duplicates unless listed', () => {
    expect(confirmImportRequestSchema.parse({})).toEqual({ includePossibleDuplicates: [] });
  });

  it('describes the template and the size limit', () => {
    expect(MONTRA_TEMPLATE_COLUMNS.filter((c) => c.required).map((c) => c.header)).toEqual([
      'Date',
      'Type',
      'Amount',
      'Description',
      'Category',
    ]);
    expect(IMPORT_MAX_FILE_BYTES).toBe(5 * 1024 * 1024);
  });
});
