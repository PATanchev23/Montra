import { resolvePeriod } from '@montra/shared';
import { describe, expect, it } from 'vitest';
import { bucketLabels, customRangeProblem, describePeriod, rangeLabel, shareLabel } from './period';

const today = '2026-11-09';
const text = (period: Parameters<typeof resolvePeriod>[0]) =>
  describePeriod(period.period, resolvePeriod(period, today));

describe('period wording', () => {
  it('names each kind of period and what it is compared with', () => {
    expect(text({ period: '30d' })).toEqual({
      label: 'Last 30 days',
      phrase: 'in the last 30 days',
      comparison: 'vs. previous 30 days',
    });
    expect(text({ period: 'month' })).toEqual({
      label: 'November 2026',
      phrase: 'this month so far',
      comparison: 'vs. same days last month',
    });
    expect(text({ period: 'last-month' })).toEqual({
      label: 'October 2026',
      phrase: 'in October 2026',
      comparison: 'vs. September',
    });
    expect(text({ period: 'custom', from: '2026-10-01', to: '2026-10-01' })).toEqual({
      label: '1 Oct 2026',
      phrase: 'on 1 Oct 2026',
      comparison: 'vs. previous 1 day',
    });
  });

  it('writes ranges compactly', () => {
    expect(rangeLabel('2026-10-01', '2026-10-31')).toBe('1 – 31 Oct 2026');
    expect(rangeLabel('2026-10-11', '2026-11-09')).toBe('11 Oct – 9 Nov 2026');
    expect(rangeLabel('2025-12-20', '2026-01-05')).toBe('20 Dec 2025 – 5 Jan 2026');
  });

  it('labels chart buckets by their interval', () => {
    expect(bucketLabels({ start: '2026-11-09', end: '2026-11-09' }, 'day', 7)).toEqual({
      label: 'Mon',
      title: 'Monday, 9 November 2026',
    });
    expect(bucketLabels({ start: '2026-11-09', end: '2026-11-09' }, 'day', 30).label).toBe('9');
    expect(bucketLabels({ start: '2026-10-01', end: '2026-10-07' }, 'week', 13)).toEqual({
      label: '1 Oct',
      title: '1 – 7 Oct 2026',
    });
    expect(bucketLabels({ start: '2026-10-01', end: '2026-10-31' }, 'month', 6).title).toBe(
      'October 2026',
    );
    expect(bucketLabels({ start: '2026-10-15', end: '2026-10-31' }, 'month', 6).title).toBe(
      '15 – 31 Oct 2026',
    );
  });

  it('explains custom ranges the API would refuse', () => {
    expect(customRangeProblem({ period: '30d' })).toBeNull();
    expect(customRangeProblem({ period: 'custom', from: '2026-10-01' })).toBe(
      'Choose a start and an end date.',
    );
    expect(customRangeProblem({ period: 'custom', from: '2026-10-02', to: '2026-10-01' })).toBe(
      'The start date is after the end date.',
    );
    expect(customRangeProblem({ period: 'custom', from: '2010-01-01', to: '2026-10-01' })).toBe(
      'Choose at most 1830 days.',
    );
    expect(
      customRangeProblem({ period: 'custom', from: '2026-10-01', to: '2026-10-31' }),
    ).toBeNull();
  });

  it('formats shares from basis points', () => {
    expect(shareLabel(7753)).toBe('77.5%');
    expect(shareLabel(10_000)).toBe('100%');
    expect(shareLabel(3)).toBe('<0.1%');
    expect(shareLabel(0)).toBe('0%');
  });
});
