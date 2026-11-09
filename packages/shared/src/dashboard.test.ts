import { describe, expect, it } from 'vitest';
import {
  dashboardQuerySchema,
  isoAddDays,
  isoDaysBetween,
  isoEndOfMonth,
  isoShiftMonth,
  resolvePeriod,
  shareBasisPoints,
  todayIn,
  trendBuckets,
  trendInterval,
} from './dashboard';

describe('date maths', () => {
  it('adds days across months, years and leap days', () => {
    expect(isoAddDays('2026-11-09', -29)).toBe('2026-10-11');
    expect(isoAddDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(isoAddDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(isoDaysBetween('2026-10-01', '2026-10-31')).toBe(30);
  });

  it('finds month ends and shifts months', () => {
    expect(isoEndOfMonth('2026-02-10')).toBe('2026-02-28');
    expect(isoEndOfMonth('2028-02-10')).toBe('2028-02-29');
    expect(isoShiftMonth('2026-01-31', -1)).toBe('2025-12-01');
    expect(isoShiftMonth('2026-03-31', -1)).toBe('2026-02-01');
  });

  it('knows today in the business’s time zone', () => {
    const late = new Date('2026-11-09T23:30:00Z');
    expect(todayIn('Europe/Sofia', late)).toBe('2026-11-10');
    expect(todayIn('America/New_York', late)).toBe('2026-11-09');
  });
});

describe('periods', () => {
  const today = '2026-11-09';

  it('counts rolling periods back from today, against the days just before', () => {
    expect(resolvePeriod({ period: '7d' }, today)).toEqual({
      period: '7d',
      from: '2026-11-03',
      to: '2026-11-09',
      previousFrom: '2026-10-27',
      previousTo: '2026-11-02',
      interval: 'day',
    });
    expect(resolvePeriod({ period: '30d' }, today)).toMatchObject({
      from: '2026-10-11',
      previousFrom: '2026-09-11',
      previousTo: '2026-10-10',
      interval: 'day',
    });
    expect(resolvePeriod({ period: '90d' }, today)).toMatchObject({
      from: '2026-08-12',
      interval: 'week',
    });
  });

  it('compares this month so far with the same days of last month', () => {
    expect(resolvePeriod({ period: 'month' }, today)).toMatchObject({
      from: '2026-11-01',
      to: '2026-11-09',
      previousFrom: '2026-10-01',
      previousTo: '2026-10-09',
    });
    // 31 March: February has no 31st, so the comparison stops at its end.
    expect(resolvePeriod({ period: 'month' }, '2026-03-31')).toMatchObject({
      previousFrom: '2026-02-01',
      previousTo: '2026-02-28',
    });
  });

  it('compares last month with the month before it', () => {
    expect(resolvePeriod({ period: 'last-month' }, '2026-03-15')).toMatchObject({
      from: '2026-02-01',
      to: '2026-02-28',
      previousFrom: '2026-01-01',
      previousTo: '2026-01-31',
    });
  });

  it('compares a custom range with as many days before it, by month when long', () => {
    expect(
      resolvePeriod({ period: 'custom', from: '2026-01-01', to: '2026-06-30' }, today),
    ).toEqual({
      period: 'custom',
      from: '2026-01-01',
      to: '2026-06-30',
      previousFrom: '2025-07-04',
      previousTo: '2025-12-31',
      interval: 'month',
    });
  });

  it('validates the query', () => {
    expect(dashboardQuerySchema.parse({})).toEqual({ period: '30d' });
    const problems = (query: object) =>
      dashboardQuerySchema.safeParse(query).error?.issues.map((i) => i.message);
    expect(problems({ period: 'custom', from: '2026-01-01' })).toEqual([
      'A custom period needs both `from` and `to`.',
    ]);
    expect(problems({ period: 'custom', from: '2026-02-01', to: '2026-01-01' })).toEqual([
      '`from` must not be after `to`.',
    ]);
    expect(problems({ period: 'custom', from: '2010-01-01', to: '2026-01-01' })).toEqual([
      'Choose at most 1830 days.',
    ]);
    expect(problems({ period: '7d', from: '2026-01-01' })).toEqual([
      '`from` and `to` apply only to a custom period.',
    ]);
    expect(problems({ period: 'year' })).toHaveLength(1);
  });
});

describe('trend buckets', () => {
  it('groups by day, week or month without gaps', () => {
    expect(trendInterval(7)).toBe('day');
    expect(trendInterval(31)).toBe('day');
    expect(trendInterval(32)).toBe('week');
    expect(trendInterval(93)).toBe('month');

    expect(trendBuckets('2026-11-01', '2026-11-03', 'day')).toEqual([
      { start: '2026-11-01', end: '2026-11-01' },
      { start: '2026-11-02', end: '2026-11-02' },
      { start: '2026-11-03', end: '2026-11-03' },
    ]);
    expect(trendBuckets('2026-10-01', '2026-10-17', 'week')).toEqual([
      { start: '2026-10-01', end: '2026-10-07' },
      { start: '2026-10-08', end: '2026-10-14' },
      { start: '2026-10-15', end: '2026-10-17' },
    ]);
    expect(trendBuckets('2026-01-15', '2026-03-10', 'month')).toEqual([
      { start: '2026-01-15', end: '2026-01-31' },
      { start: '2026-02-01', end: '2026-02-28' },
      { start: '2026-03-01', end: '2026-03-10' },
    ]);
  });
});

describe('shares', () => {
  it('always add up to exactly 100%', () => {
    expect(shareBasisPoints([1, 1, 1])).toEqual([3334, 3333, 3333]);
    expect(shareBasisPoints([80_000, 31_045, 4_280])).toEqual([6937, 2692, 371]);
    expect(shareBasisPoints([5, 0])).toEqual([10_000, 0]);
    expect(shareBasisPoints([0, 0])).toEqual([0, 0]);
  });
});
