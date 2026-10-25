import { describe, expect, it } from 'vitest';
import { formatMoney, fromCents, toCents } from './money';

describe('toCents', () => {
  it('converts decimal amounts to integer cents', () => {
    expect(toCents(12.34)).toBe(1234);
    expect(toCents(0)).toBe(0);
    expect(toCents(-7.5)).toBe(-750);
  });

  it('rounds half away from zero without float drift', () => {
    expect(toCents(1.005)).toBe(101);
    expect(toCents(-1.005)).toBe(-101);
    expect(toCents(0.1 + 0.2)).toBe(30);
  });

  it('rejects non-finite input', () => {
    expect(() => toCents(Number.NaN)).toThrow(RangeError);
    expect(() => toCents(Infinity)).toThrow(RangeError);
  });
});

describe('fromCents', () => {
  it('rejects fractional cents', () => {
    expect(() => fromCents(10.5)).toThrow(RangeError);
  });
});

describe('formatMoney', () => {
  it('formats EUR by default', () => {
    expect(formatMoney(123456)).toBe('€1,234.56');
  });

  it('supports signed and compact output', () => {
    expect(formatMoney(5000, { signed: true })).toBe('+€50.00');
    expect(formatMoney(-5000, { signed: true })).toBe('-€50.00');
    expect(formatMoney(12_500_000, { compact: true })).toBe('€125K');
  });
});
