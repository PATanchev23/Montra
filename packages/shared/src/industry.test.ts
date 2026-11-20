import { describe, expect, it } from 'vitest';
import { industryKind } from './industry';

describe('industryKind', () => {
  it('reads the onboarding cards in either language, and owners’ own words', () => {
    expect(industryKind('Electronics')).toBe('electronics');
    expect(industryKind('Мода')).toBe('fashion');
    expect(industryKind('Храни и напитки')).toBe('food');
    expect(industryKind(' Consumer electronics ')).toBe('electronics');
    expect(industryKind('Handmade candles')).toBe('handmade');
  });

  it('matches whole word beginnings only, and names nothing it does not know', () => {
    // "art" is not found inside "smartwatch".
    expect(industryKind('Smartwatch straps')).toBeNull();
    expect(industryKind('Smartphones')).toBe('electronics');
    expect(industryKind('Consulting')).toBeNull();
    expect(industryKind('')).toBeNull();
    expect(industryKind(null)).toBeNull();
  });
});
