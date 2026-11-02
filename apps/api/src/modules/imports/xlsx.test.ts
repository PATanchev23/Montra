import { describe, expect, it } from 'vitest';
import { readTable } from './table';
import { FileReadError } from './types';
import { readXlsx, writeXlsx } from './xlsx';

const rows = [
  ['Date', 'Description', 'Amount', 'Note'],
  [{ date: '2026-10-05' }, 'Café & “quotes” <ok>', 1234.5, null],
  [{ date: '2024-02-29' }, 'Second', -12, 'x'],
];

describe('XLSX', () => {
  it.each([
    ['shared strings, compressed', { sharedStrings: true, compress: true }],
    ['inline strings, stored', { sharedStrings: false, compress: false }],
  ])('reads back what it writes (%s)', (_label, options) => {
    expect(readXlsx(writeXlsx(rows, options), 100)).toEqual([
      { row: 1, cells: ['Date', 'Description', 'Amount', 'Note'] },
      { row: 2, cells: ['2026-10-05', 'Café & “quotes” <ok>', 1234.5] },
      { row: 3, cells: ['2024-02-29', 'Second', -12, 'x'] },
    ]);
  });

  it('becomes a table with a header and data rows', () => {
    const table = readTable(writeXlsx(rows), 'XLSX');
    expect(table.columns).toEqual(['Date', 'Description', 'Amount', 'Note']);
    expect(table.rows.map((row) => row.row)).toEqual([2, 3]);
  });

  it('skips empty rows and stops after the row limit', () => {
    const many = [['A'], ...Array.from({ length: 10 }, (_, i) => [`v${i}`]), [null], ['last']];
    const read = readXlsx(writeXlsx(many), 5);
    expect(read).toHaveLength(6);
    expect(
      readXlsx(writeXlsx(many), 100)
        .map((row) => row.row)
        .at(-1),
    ).toBe(13);
  });

  it('refuses files that are not workbooks or are damaged', () => {
    expect(() => readXlsx(Buffer.from('PK\u0003\u0004 not really a zip'), 10)).toThrow(
      FileReadError,
    );
    const file = writeXlsx(rows);
    const truncated = file.subarray(0, file.length - 40);
    expect(() => readXlsx(truncated, 10)).toThrow(FileReadError);
  });
});
