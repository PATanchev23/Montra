import { describe, expect, it } from 'vitest';
import { decodeText, detectDelimiter, parseCsv } from './csv';
import { FileReadError } from './types';

describe('parseCsv', () => {
  it('reads quoted values with delimiters, doubled quotes and line breaks', () => {
    const text = 'a,b,c\r\n"x, y","say ""hi""","two\nlines"\r\n1,2,3';
    expect(parseCsv(text)).toEqual([
      { row: 1, cells: ['a', 'b', 'c'] },
      { row: 2, cells: ['x, y', 'say "hi"', 'two\nlines'] },
      { row: 3, cells: ['1', '2', '3'] },
    ]);
  });

  it('skips blank lines but keeps spreadsheet row numbers', () => {
    expect(parseCsv('a,b\n\n1,2\n,\n3,4\n').map((record) => record.row)).toEqual([1, 3, 5]);
  });

  it('detects semicolons and tabs, and honours a "sep=" line', () => {
    expect(detectDelimiter('Дата;Сума\n01.10.2026;1 250,00\n')).toBe(';');
    expect(detectDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t');
    expect(parseCsv('sep=|\na|b\n1|2')).toEqual([
      { row: 1, cells: ['a', 'b'] },
      { row: 2, cells: ['1', '2'] },
    ]);
  });

  it('does not split on a delimiter inside quotes when detecting', () => {
    expect(detectDelimiter('"a;b",c\n"1;2",3')).toBe(',');
  });

  it('reports a quote that is never closed', () => {
    expect(() => parseCsv('a,b\n"open,1\n2,3')).toThrow(FileReadError);
    expect(() => parseCsv('a,b\n"open,1\n2,3')).toThrow('starting on row 2');
  });
});

describe('decodeText', () => {
  it('reads UTF-8 with or without a BOM, UTF-16, and falls back to Windows-1252', () => {
    expect(parseCsv(decodeText(Buffer.from('\ufeffDate,Сума\n', 'utf8')))[0]!.cells).toEqual([
      'Date',
      'Сума',
    ]);
    const utf16 = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from('a\tb\n€\t2\n', 'utf16le'),
    ]);
    expect(parseCsv(decodeText(utf16))[1]!.cells).toEqual(['€', '2']);
    // "Café" and "€5" as Excel on Windows saves them.
    expect(decodeText(Buffer.from([0x43, 0x61, 0x66, 0xe9, 0x2c, 0x80, 0x35]))).toBe('Café,€5');
  });
});
