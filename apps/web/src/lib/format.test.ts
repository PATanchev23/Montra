import { describe, expect, it } from 'vitest';
import { compactMoney, money, percent, relativeDay } from './format';

describe('money', () => {
  it('formats cents as euros with a typographic minus', () => {
    expect(money(123456)).toBe('€1,234.56');
    expect(money(-78000)).toBe('−€780.00');
  });

  it('supports whole-euro headline figures and explicit signs', () => {
    expect(money(842050, { decimals: 0 })).toBe('€8,421');
    expect(money(342000, { sign: 'always' })).toBe('+€3,420.00');
    expect(money(-500, { sign: 'never' })).toBe('€5.00');
  });
});

describe('compactMoney and percent', () => {
  it('abbreviates large amounts', () => {
    expect(compactMoney(1_523_000)).toBe('€15.2K');
  });

  it('formats ratios', () => {
    expect(percent(0.234)).toBe('23%');
    expect(percent(-0.06, { signed: true })).toBe('−6%');
  });
});

describe('relativeDay', () => {
  const today = new Date(2026, 9, 25);
  it('names nearby days and falls back to a date', () => {
    expect(relativeDay('2026-10-25', today)).toBe('Today');
    expect(relativeDay('2026-10-26', today)).toBe('Tomorrow');
    expect(relativeDay('2026-10-24', today)).toBe('Yesterday');
    expect(relativeDay('2026-11-02', today)).toBe('2 Nov 2026');
  });
});
