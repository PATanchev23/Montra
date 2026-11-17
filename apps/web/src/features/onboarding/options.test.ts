import { afterEach, describe, expect, it } from 'vitest';
import { useUiStore } from '../../stores/ui';
import {
  currencySymbol,
  filterTimeZones,
  financialYearAround,
  industryPresetFor,
  shortMonthName,
} from './options';

afterEach(() => useUiStore.setState({ language: 'en' }));

describe('industry presets', () => {
  it('finds the card an answer came from, in either language and any case', () => {
    expect(industryPresetFor('Electronics')).toBe('electronics');
    expect(industryPresetFor('  home & living ')).toBe('home');
    expect(industryPresetFor('Електроника')).toBe('electronics');
  });

  it('treats the owner’s own words and blanks as no card', () => {
    expect(industryPresetFor('Consumer electronics')).toBeUndefined();
    expect(industryPresetFor('')).toBeUndefined();
  });
});

describe('financial year', () => {
  it('spans twelve months from the start month that contains today', () => {
    const today = new Date(2026, 10, 17); // 17 November 2026
    const calendarYear = financialYearAround(1, today);
    expect(calendarYear.range).toMatch(/^1 January.*31 December 2026$/);
    expect(calendarYear.monthOf).toBe(11);
    expect(financialYearAround(7, today).monthOf).toBe(5);
    // A start month later in the year than today began last year.
    expect(financialYearAround(12, today).range).toMatch(/2025.*2026/);
    expect(financialYearAround(12, today).monthOf).toBe(12);
  });
});

describe('month and currency labels', () => {
  it('abbreviates months from their full names, in English and Bulgarian', () => {
    expect(shortMonthName(1)).toBe('Jan');
    expect(shortMonthName(9)).toBe('Sep');
    useUiStore.setState({ language: 'bg' });
    // bg-BG's own short form is numeric in some browsers ("01"); the grid needs words.
    expect(shortMonthName(1)).toBe('яну');
    expect(shortMonthName(11)).toBe('ное');
  });

  it('gives each currency the sign its amounts are written with', () => {
    expect(currencySymbol('EUR')).toBe('€');
    expect(currencySymbol('GBP')).toBe('£');
  });
});

describe('time zone search', () => {
  const options = [
    { value: 'America/New_York', label: 'America/New York (GMT-5)' },
    { value: 'Europe/London', label: 'Europe/London (GMT+0)' },
    { value: 'Europe/Sofia', label: 'Europe/Sofia (GMT+2)' },
  ];

  it('matches every word, ignoring case, accents and separators', () => {
    expect(filterTimeZones(options, 'new york').map((o) => o.value)).toEqual(['America/New_York']);
    expect(filterTimeZones(options, 'EUROPE so').map((o) => o.value)).toEqual(['Europe/Sofia']);
    expect(filterTimeZones(options, 'gmt+0').map((o) => o.value)).toEqual(['Europe/London']);
  });

  it('lists everything for an empty search and nothing for a miss', () => {
    expect(filterTimeZones(options, '  ')).toHaveLength(3);
    expect(filterTimeZones(options, 'atlantis')).toEqual([]);
  });
});
