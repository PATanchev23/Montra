import { describe, expect, it } from 'vitest';
import {
  assignColumn,
  columnOptions,
  draftFrom,
  draftProblem,
  isDirty,
  mappingFrom,
} from './mapping';
import { fileProblem, sourceFor } from './upload';

describe('column mapping drafts', () => {
  const saved = {
    columns: { date: 0, description: 1, amount: 2 },
    dateFormat: 'DMY' as const,
    decimalSeparator: ',' as const,
  };

  it('round-trips the API’s mapping, leaving "detect" settings out', () => {
    const draft = draftFrom(saved);
    expect(draft).toEqual({
      columns: { date: 0, description: 1, amount: 2 },
      dateFormat: 'DMY',
      decimalSeparator: ',',
      defaultCategory: '',
    });
    expect(mappingFrom(draft)).toEqual(saved);
    expect(
      mappingFrom({ ...draft, dateFormat: 'auto', decimalSeparator: 'auto', defaultCategory: ' ' }),
    ).toEqual({ columns: saved.columns });
    expect(draftFrom(null)).toEqual({
      columns: {},
      dateFormat: 'auto',
      decimalSeparator: 'auto',
      defaultCategory: '',
    });
  });

  it('moves a column to its new field, so no column is mapped twice', () => {
    const draft = assignColumn(draftFrom(saved), 'category', 1);
    expect(draft.columns).toEqual({ date: 0, amount: 2, category: 1 });
    expect(assignColumn(draft, 'amount', undefined).columns).toEqual({ date: 0, category: 1 });
  });

  it('knows when the draft differs from what the API uses, however it was edited', () => {
    const draft = draftFrom(saved);
    expect(isDirty(draft, saved)).toBe(false);
    const edited = assignColumn(draft, 'amount', 3);
    expect(isDirty(edited, saved)).toBe(true);
    expect(isDirty(assignColumn(edited, 'amount', 2), saved)).toBe(false);
    expect(isDirty({ ...draft, defaultCategory: 'Other' }, saved)).toBe(true);
  });

  it('checks the draft with the shared rules', () => {
    expect(draftProblem(draftFrom(saved))).toBeNull();
    expect(draftProblem({ ...draftFrom(saved), defaultCategory: 'x'.repeat(61) })).toBe(
      'Default category: Use at most 60 characters.',
    );
  });

  it('labels columns by header and a sample value', () => {
    expect(
      columnOptions(
        ['Дата', '', 'A very long column header'],
        [
          ['', 'x', ''],
          ['01.10.2026', 'y', 'An extremely long sample value indeed'],
        ],
      ),
    ).toEqual([
      { value: '0', label: 'Дата — e.g. 01.10.2026' },
      { value: '1', label: 'Column 2 — e.g. x' },
      { value: '2', label: 'A very long column header — e.g. An extremely long sam…' },
    ]);
  });
});

describe('choosing a file', () => {
  const file = (name: string, size = 10) => new File(['x'.repeat(size)], name);

  it('picks the source from the kind and the file name', () => {
    expect(sourceFor('template', 'October.xlsx')).toBe('MONTRA_TEMPLATE');
    expect(sourceFor('generic', 'Statement.XLSX')).toBe('GENERIC_EXCEL');
    expect(sourceFor('generic', 'statement.csv')).toBe('GENERIC_CSV');
  });

  it('spots files the API would refuse', () => {
    expect(fileProblem(file('statement.csv'))).toBeNull();
    expect(fileProblem(file('report.pdf'))).toMatch(/Choose a \.csv or \.xlsx file/);
    expect(fileProblem(file('old.xls'))).toMatch(/Choose a \.csv or \.xlsx file/);
    expect(fileProblem(file('empty.csv', 0))).toBe('This file is empty.');
    expect(fileProblem(file('huge.csv', 5 * 1024 * 1024 + 1))).toBe(
      'This file is larger than 5 MB.',
    );
  });
});
