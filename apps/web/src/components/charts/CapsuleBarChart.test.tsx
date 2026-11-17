import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CapsuleBarChart } from './CapsuleBarChart';

// jsdom has no layout; give the chart a size so it draws.
vi.mock('./useElementSize', () => ({
  useElementSize: () => [{ current: null }, { width: 480, height: 240 }],
}));

const categories = ['Week 1', 'Week 2', 'Week 3'].map((label) => ({ key: label, label }));

function renderChart() {
  render(
    <CapsuleBarChart
      ariaLabel="Income by week"
      categories={categories}
      series={[{ id: 'income', label: 'Income', values: [10, 20, 30], tone: 'primary' }]}
      formatValue={(value) => `€${value}`}
      describe={(index) => `Week ${index + 1} selected.`}
      renderTooltip={(index) => `Tooltip for week ${index + 1}`}
    />,
  );
  return screen.getByRole('group', { name: /^Income by week\./ });
}

const announcement = () => screen.queryByText(/^Week \d selected\.$/);

describe('reading a period on the capsule chart', () => {
  it('steps through periods with the arrow keys, announcing each one', () => {
    const chart = renderChart();
    expect(screen.queryByText(/^Tooltip for/)).not.toBeInTheDocument();

    fireEvent.keyDown(chart, { key: 'ArrowRight' });
    expect(screen.getByText('Tooltip for week 1')).toBeInTheDocument();
    expect(announcement()).toHaveTextContent('Week 1 selected.');

    fireEvent.keyDown(chart, { key: 'ArrowRight' });
    fireEvent.keyDown(chart, { key: 'End' });
    expect(screen.getByText('Tooltip for week 3')).toBeInTheDocument();
    // It stops at the last period rather than wrapping round.
    fireEvent.keyDown(chart, { key: 'ArrowRight' });
    expect(announcement()).toHaveTextContent('Week 3 selected.');

    fireEvent.keyDown(chart, { key: 'Home' });
    expect(announcement()).toHaveTextContent('Week 1 selected.');
  });

  it('pins a period on click and releases it on a second click, Escape or blur', () => {
    const chart = renderChart();
    // The plot starts after the value axis; each of the three periods is a band of it.
    const inWeek2 = { clientX: 260 };

    fireEvent.click(chart, inWeek2);
    expect(screen.getByText('Tooltip for week 2')).toBeInTheDocument();
    expect(announcement()).toHaveTextContent('Week 2 selected.');
    fireEvent.click(chart, inWeek2);
    expect(screen.queryByText(/^Tooltip for/)).not.toBeInTheDocument();

    fireEvent.click(chart, inWeek2);
    fireEvent.keyDown(chart, { key: 'Escape' });
    expect(announcement()).not.toBeInTheDocument();

    fireEvent.click(chart, inWeek2);
    fireEvent.blur(chart);
    expect(screen.queryByText(/^Tooltip for/)).not.toBeInTheDocument();
  });

  it('keeps every value in a table for screen readers', () => {
    renderChart();
    const rows = screen.getAllByRole('row').map((row) => row.textContent);
    expect(rows).toEqual(['PeriodIncome', 'Week 1€10', 'Week 2€20', 'Week 3€30']);
  });
});
