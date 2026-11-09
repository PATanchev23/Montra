import { describe, expect, it } from 'vitest';
import { filtersFromParams, listParamsFrom, presetBounds } from './useTransactionFilters';

const today = new Date(2026, 10, 9); // 9 November 2026
const filters = (query: string) => filtersFromParams(new URLSearchParams(query));

describe('filters in the URL', () => {
  it('defaults to all transactions, newest first, page 1', () => {
    expect(filters('')).toEqual({
      type: 'all',
      category: '',
      range: 'all',
      from: '',
      to: '',
      sort: 'date_desc',
      page: 1,
      q: '',
    });
  });

  it('reads every filter, and ignores values the API would reject', () => {
    expect(
      filters('type=income&category=Advertising&range=month&sort=amount_asc&page=3'),
    ).toMatchObject({
      type: 'income',
      category: 'Advertising',
      range: 'month',
      sort: 'amount_asc',
      page: 3,
    });
    expect(filters('type=transfer&range=decade&sort=newest&page=-2')).toMatchObject({
      type: 'all',
      range: 'all',
      sort: 'date_desc',
      page: 1,
    });
    // An explicit date makes the range custom; an invalid one is dropped.
    expect(filters('from=2026-10-01&to=not-a-date')).toMatchObject({
      range: 'custom',
      from: '2026-10-01',
      to: '',
    });
  });
});

describe('date presets', () => {
  it('count back from today, inclusive', () => {
    expect(presetBounds('all', today)).toEqual({});
    expect(presetBounds('30d', today)).toEqual({ from: '2026-10-11', to: '2026-11-09' });
    expect(presetBounds('90d', today)).toEqual({ from: '2026-08-12', to: '2026-11-09' });
    expect(presetBounds('month', today)).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(presetBounds('last-month', today)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(presetBounds('year', today)).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });
});

describe('the API query', () => {
  it('names only the filters in use', () => {
    expect(listParamsFrom(filters(''), today)).toEqual({
      params: {
        page: 1,
        pageSize: 25,
        sort: 'date_desc',
        type: undefined,
        category: undefined,
      },
      rangeError: null,
    });
    expect(
      listParamsFrom(filters('type=expense&category=Rent&range=last-month&page=2'), today).params,
    ).toEqual({
      page: 2,
      pageSize: 25,
      sort: 'date_desc',
      type: 'EXPENSE',
      category: 'Rent',
      from: '2026-10-01',
      to: '2026-10-31',
    });
  });

  it('refuses a custom range that runs backwards', () => {
    const { params, rangeError } = listParamsFrom(filters('from=2026-10-31&to=2026-10-01'), today);
    expect(rangeError).toBe('The start date is after the end date.');
    expect(params).toMatchObject({ from: '2026-10-31', to: '2026-10-01' });
  });
});
