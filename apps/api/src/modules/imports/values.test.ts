import { describe, expect, it } from 'vitest';
import {
  detectDateFormat,
  detectDecimalSeparator,
  excelSerialToDate,
  parseAmount,
  parseDate,
  parseType,
} from './values';

describe('parseAmount', () => {
  it.each([
    ['1234.5', '.', 123450, null],
    ['1,234.50', '.', 123450, null],
    ['1.234,50', ',', 123450, null],
    ['1 234,50', ',', 123450, null],
    ['-12.50', '.', -1250, null],
    ['(12.50)', '.', -1250, null],
    ['12.50-', '.', -1250, null],
    ['€12.50', '.', 1250, 'EUR'],
    ['-€12.50', '.', -1250, 'EUR'],
    ['12.50 USD', '.', 1250, 'USD'],
    ['+7', '.', 700, null],
  ] as const)('reads %j with "%s" decimals as %d cents', (text, separator, cents, currency) => {
    expect(parseAmount(text, separator)).toEqual({ ok: true, value: { cents, currency } });
  });

  it('takes spreadsheet numbers as they are', () => {
    expect(parseAmount(1234.5, ',')).toEqual({
      ok: true,
      value: { cents: 123450, currency: null },
    });
    expect(parseAmount(0.1 + 0.2, '.')).toMatchObject({ ok: true, value: { cents: 30 } });
  });

  it.each([
    ['', 'The amount is missing.'],
    ['abc', '“abc” is not an amount.'],
    ['12.345', 'Use at most two decimal places.'],
    ['12,34', '“12,34” is not an amount.'],
    ['1.2.3', '“1.2.3” is not an amount.'],
  ])('rejects %j', (text, message) => {
    expect(parseAmount(text, '.')).toEqual({ ok: false, message });
  });
});

describe('detectDecimalSeparator', () => {
  it('picks the separator that reads every value', () => {
    expect(detectDecimalSeparator(['1 250,00', '-310,45'])).toBe(',');
    expect(detectDecimalSeparator(['1,250.00', '-310.45'])).toBe('.');
    // Three digits after a comma can only be thousands.
    expect(detectDecimalSeparator(['1,250', '42'])).toBe('.');
    expect(detectDecimalSeparator(['1.250', '42'])).toBe(',');
    expect(detectDecimalSeparator(['42', 17])).toBe('.');
  });
});

describe('parseDate', () => {
  it('reads year-first dates in any format, dropping time and offset', () => {
    expect(parseDate('2026-10-05', 'DMY')).toEqual({ ok: true, value: '2026-10-05' });
    expect(parseDate('2026-10-05 14:31:09 +0300', 'YMD')).toEqual({
      ok: true,
      value: '2026-10-05',
    });
    expect(parseDate('2026-10-05T23:59:00-05:00', 'YMD')).toEqual({
      ok: true,
      value: '2026-10-05',
    });
  });

  it('reads day and month in the given order', () => {
    expect(parseDate('05.10.2026', 'DMY')).toEqual({ ok: true, value: '2026-10-05' });
    expect(parseDate('05/10/2026', 'MDY')).toEqual({ ok: true, value: '2026-05-10' });
    expect(parseDate('05.10.2026 г.', 'DMY')).toEqual({ ok: true, value: '2026-10-05' });
  });

  it('converts Excel serial numbers', () => {
    expect(parseDate(46299, 'YMD')).toEqual({ ok: true, value: '2026-10-04' });
    expect(excelSerialToDate(1)).toBe('1900-01-01');
    expect(excelSerialToDate(61)).toBe('1900-03-01');
    expect(excelSerialToDate(0, true)).toBeNull();
    expect(excelSerialToDate(1, true)).toBe('1904-01-02');
  });

  it.each([
    ['', 'The date is missing.'],
    ['2026-02-30', '“2026-02-30” is not a date Montra can read.'],
    ['31/12/2026', '“31/12/2026” is not a date Montra can read.'],
    ['yesterday', '“yesterday” is not a date Montra can read.'],
  ])('rejects %j', (text, message) => {
    expect(parseDate(text, 'MDY')).toEqual({ ok: false, message });
  });
});

describe('detectDateFormat', () => {
  it('decides from a value that can be read only one way', () => {
    expect(detectDateFormat(['01.10.2026', '13.10.2026'])).toBe('DMY');
    expect(detectDateFormat(['10/01/2026', '10/13/2026'])).toBe('MDY');
    expect(detectDateFormat(['2026-10-01', 46300])).toBe('YMD');
  });

  it('refuses to guess when every value could be read either way', () => {
    expect(detectDateFormat(['01/02/2026', '03/04/2026'])).toBeNull();
  });
});

describe('parseType', () => {
  it('understands common words for each direction, in English and Bulgarian', () => {
    for (const word of ['Income', 'credit', 'CR', 'Приход']) expect(parseType(word)).toBe('INCOME');
    for (const word of ['Expense', 'debit', 'DR', 'разход'])
      expect(parseType(word)).toBe('EXPENSE');
    expect(parseType('payment')).toBeNull();
    expect(parseType('')).toBeNull();
  });
});
