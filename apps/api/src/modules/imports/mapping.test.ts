import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  mappedEntries,
  mappingNotices,
  resolveMapping,
  suggestMapping,
  templateMapping,
} from './mapping';
import { readTable } from './table';
import type { DraftEntry } from './types';

const fixture = (name: string) =>
  readTable(readFileSync(new URL(`../../../test/fixtures/${name}`, import.meta.url)), 'CSV');

/** Compact view of entries: status, row, and type/amount/date or the first note/issue. */
const summary = (entries: DraftEntry[]) =>
  entries.map((entry) =>
    entry.transaction
      ? [
          entry.status,
          entry.row,
          entry.transaction.type,
          entry.transaction.amountCents,
          entry.transaction.date,
        ]
      : [entry.status, entry.row, entry.issues[0]?.message ?? entry.notes[0]],
  );

describe('Montra template', () => {
  const table = fixture('template.csv');
  const { mapping, absent } = templateMapping(table.columns);
  const resolved = resolveMapping(table, mapping, { requireType: true });
  const entries = mappedEntries(table, resolved.mapping, 'EUR', { requireType: true });

  it('finds every template column', () => {
    expect(absent).toEqual([]);
    expect(resolved.missing).toEqual([]);
    expect(resolved.mapping).toMatchObject({ dateFormat: 'YMD', decimalSeparator: '.' });
  });

  it('reads valid rows and explains each invalid one', () => {
    expect(summary(entries)).toEqual([
      ['VALID', 2, 'INCOME', 150000, '2026-10-01'],
      ['VALID', 3, 'EXPENSE', 8999, '2026-10-02'],
      ['INVALID', 4, '“abc” is not an amount.'],
      ['INVALID', 5, 'The description is missing.'],
      ['INVALID', 6, '“2026-31-12” is not a date Montra can read.'],
      ['INVALID', 7, 'Amounts in USD cannot be imported: this business records amounts in EUR.'],
      ['VALID', 8, 'EXPENSE', 1550, '2026-10-06'],
      ['VALID', 9, 'EXPENSE', 1550, '2026-10-06'],
    ]);
    expect(entries[0]!.transaction).toMatchObject({ externalId: 'INV-1', category: 'Sales' });
    expect(entries[2]).toMatchObject({
      issues: [{ field: 'amount' }],
      cells: ['2026-10-03', 'Expense', 'abc', 'Broken amount', 'Software', '', ''],
    });
  });

  it('lists required template columns that are missing', () => {
    expect(templateMapping(['date', 'AMOUNT', 'Description']).absent).toEqual(['Type', 'Category']);
  });
});

describe('generic files', () => {
  const table = fixture('bank-statement.csv');

  it('suggests a mapping from header names, including Bulgarian ones', () => {
    expect(suggestMapping(table.columns)).toEqual({
      columns: { date: 0, description: 1, amount: 2, currency: 3, externalId: 4 },
    });
  });

  it('needs a category column or a default category', () => {
    const resolved = resolveMapping(table, suggestMapping(table.columns), { requireType: false });
    expect(resolved.missing).toEqual(['category']);
    expect(resolved.mapping).toMatchObject({ dateFormat: 'DMY', decimalSeparator: ',' });
  });

  it('reads signed amounts as income and expenses', () => {
    const resolved = resolveMapping(
      table,
      { ...suggestMapping(table.columns), defaultCategory: 'Bank' },
      { requireType: false },
    );
    const entries = mappedEntries(table, resolved.mapping, 'EUR', { requireType: false });
    expect(summary(entries)).toEqual([
      ['VALID', 2, 'INCOME', 125000, '2026-10-01'],
      ['VALID', 3, 'EXPENSE', 31045, '2026-10-02'],
      ['VALID', 4, 'EXPENSE', 80000, '2026-10-13'],
      ['VALID', 5, 'EXPENSE', 4280, '2026-10-14'],
    ]);
    expect(entries[0]!.transaction).toMatchObject({
      description: 'Плащане от клиент - фактура 114',
      category: 'Bank',
      externalId: 'TX-1001',
    });
  });

  it('asks for the date format when every date could be read both ways', () => {
    const ambiguous = {
      columns: ['Date', 'Amount'],
      rows: [{ row: 2, cells: ['01/02/2026', '5'] }],
    };
    expect(
      resolveMapping(
        ambiguous,
        { columns: { date: 0, amount: 1, description: 0 }, defaultCategory: 'X' },
        { requireType: false },
      ).missing,
    ).toEqual(['dateFormat']);
  });

  it('flags malformed rows, unknown types and zero amounts', () => {
    const table = {
      columns: ['Date', 'Description', 'Amount', 'Type'],
      rows: [
        { row: 2, cells: ['2026-10-01', 'Extra', '5', 'Income', 'stray'] },
        { row: 3, cells: ['2026-10-01', 'Odd type', '5', 'refund?'] },
        { row: 4, cells: ['2026-10-01', 'Nothing', '0', 'Expense'] },
        { row: 5, cells: ['2026-10-01', 'Contradiction', '-5', 'Income'] },
        { row: 6, cells: ['2026-10-01', 'Negative expense', '-5', 'Expense'] },
        { row: 7, cells: ['2026-10-01', 'Sign only', '-5', ''] },
      ],
    };
    const mapping = {
      columns: { date: 0, description: 1, amount: 2, type: 3 },
      defaultCategory: 'Other',
    };
    const entries = mappedEntries(
      table,
      resolveMapping(table, mapping, { requireType: false }).mapping,
      'EUR',
      {
        requireType: false,
      },
    );
    expect(summary(entries)).toEqual([
      [
        'INVALID',
        2,
        'This row has more values than the header has columns. Check for an unquoted separator.',
      ],
      ['INVALID', 3, '“refund?” is not a type Montra knows. Use Income or Expense.'],
      ['INVALID', 4, 'The amount is zero.'],
      ['INVALID', 5, 'The amount is negative, but the type is income.'],
      ['VALID', 6, 'EXPENSE', 500, '2026-10-01'],
      ['VALID', 7, 'EXPENSE', 500, '2026-10-01'],
    ]);
    expect(entries[5]!.notes).toEqual(['No type given; read from the amount’s sign.']);
  });
});

describe('column detection', () => {
  it('ignores brackets, punctuation and a trailing currency in headers', () => {
    expect(
      suggestMapping(['Booking date', 'Payment details', 'Amount (EUR)', 'Ref.', 'Notes']),
    ).toEqual({ columns: { date: 0, description: 1, amount: 2, externalId: 3 } });
    expect(suggestMapping(['Вальор', 'Основание за плащане', 'Сума, лв.', 'Дебит/Кредит'])).toEqual(
      { columns: { date: 0, description: 1, amount: 2, type: 3 } },
    );
  });

  it('finds template columns the same way', () => {
    const { mapping, absent } = templateMapping([
      'DATE',
      'Type',
      'Amount (EUR)',
      'Description',
      'Category',
    ]);
    expect(absent).toEqual([]);
    expect(mapping.columns).toEqual({ date: 0, type: 1, amount: 2, description: 3, category: 4 });
  });

  it('never maps one column to two fields', () => {
    expect(suggestMapping(['Date', 'Value date', 'Amount'])).toEqual({
      columns: { date: 0, amount: 2 },
    });
  });
});

describe('mapping notices', () => {
  const table = fixture('bank-statement.csv');

  it('say how dates, amounts and directions are read, and what is left out', () => {
    const { columns } = suggestMapping(table.columns);
    const { currency: _currency, ...withoutCurrency } = columns;
    const resolved = resolveMapping(
      table,
      { columns: withoutCurrency, defaultCategory: 'Bank' },
      { requireType: false },
    );
    expect(mappingNotices(table, resolved.mapping, { requireType: false })).toEqual([
      'Dates are read day first: 05.10.2026 is 5 October 2026.',
      'Amounts use a comma for decimals: 1.250,50 means 1250.50.',
      'There is no type column: negative amounts are imported as expenses, others as income.',
      'There is no category column: every record is filed under “Bank”.',
      'Not imported: Валута.',
    ]);
  });

  it('stay quiet when the file is read as written', () => {
    const template = fixture('template.csv');
    const resolved = resolveMapping(template, templateMapping(template.columns).mapping, {
      requireType: true,
    });
    expect(mappingNotices(template, resolved.mapping, { requireType: true })).toEqual([]);
  });
});
