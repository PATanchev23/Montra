import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useUiStore } from '../../stores/ui';
import { changeKind } from './change';
import { Delta } from './Delta';

afterEach(() => useUiStore.setState({ language: 'en' }));

/** The rendered change, and whether it carries an arrow or a good/bad colour. */
function shown(props: Parameters<typeof Delta>[0]) {
  const { container } = render(<Delta {...props} />);
  const root = container.firstElementChild as HTMLElement;
  return {
    text: root.textContent ?? '',
    arrow: root.querySelector('svg') !== null,
    coloured: /text-(positive|negative)/.test(root.className),
  };
}

describe('changeKind', () => {
  it('names the change in words when no percentage would be true', () => {
    expect(changeKind(null, 0, 0)).toBe('none');
    expect(changeKind(0, 12_000, 12_000)).toBe('none');
    expect(changeKind(null, 5_000, 0)).toBe('no-earlier');
    expect(changeKind(null, -5_000, 0)).toBe('no-earlier');
    expect(changeKind(0.5, 15_000, 10_000)).toBe('ratio');
  });

  it('never trusts a ratio that is not a finite number', () => {
    expect(changeKind(Number.NaN)).toBe('no-earlier');
    expect(changeKind(Number.POSITIVE_INFINITY)).toBe('no-earlier');
    expect(changeKind(null)).toBe('no-earlier');
  });
});

describe('Delta', () => {
  it('says "No change" when both periods are zero, with no arrow or colour', () => {
    expect(shown({ ratio: null, cents: 0, previousCents: 0 })).toEqual({
      text: 'No change',
      arrow: false,
      coloured: false,
    });
  });

  it('says "No earlier data" when only the earlier period is zero, neither good nor bad', () => {
    for (const goodWhen of ['up', 'down'] as const) {
      expect(shown({ ratio: null, cents: 15_000, previousCents: 0, goodWhen })).toEqual({
        text: 'No earlier data',
        arrow: false,
        coloured: false,
      });
    }
  });

  it('never renders NaN, Infinity or 0% for an impossible ratio', () => {
    for (const ratio of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const { text } = shown({ ratio });
      expect(text).not.toMatch(/NaN|Infinity|∞|0\s?%/);
      expect(text).toBe('No earlier data');
    }
  });

  it('shows a real change as a percentage, coloured by meaning', () => {
    const rise = shown({ ratio: 0.5, cents: 15_000, previousCents: 10_000 });
    expect(rise).toEqual({ text: 'Up 50%, favourable', arrow: true, coloured: true });
    const costlier = shown({ ratio: 0.5, cents: 15_000, previousCents: 10_000, goodWhen: 'down' });
    expect(costlier.text).toBe('Up 50%, unfavourable');
  });

  it('speaks Bulgarian', () => {
    useUiStore.setState({ language: 'bg' });
    render(<Delta ratio={null} cents={0} previousCents={0} />);
    expect(screen.getByText('Без промяна')).toBeInTheDocument();
    render(<Delta ratio={null} cents={100} previousCents={0} />);
    expect(screen.getByText('Без предишни данни')).toBeInTheDocument();
  });
});
