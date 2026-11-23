import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from 'radix-ui';
import { useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { useUiStore } from '../../stores/ui';
import { PlansDialog } from './PlansDialog';
import { PlansPage } from './PlansPage';

afterEach(() => useUiStore.setState({ language: 'en' }));

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <Tooltip.Provider>
      <Routes>
        <Route path="/" element={<PlansDialog open={open} onOpenChange={setOpen} />} />
        <Route path="/plans" element={<p>Plans page</p>} />
      </Routes>
    </Tooltip.Provider>
  );
}

describe('PlansPage', () => {
  it('shows the three plans, with Free current and the paid plans not yet on sale', () => {
    render(<PlansPage />, { wrapper: MemoryRouter });

    const plans = within(screen.getByRole('list', { name: 'Plans' })).getAllByRole('article');
    expect(plans.map((plan) => within(plan).getByRole('heading').textContent)).toEqual([
      'Free',
      'Pro',
      'Business',
    ]);

    const [free, pro, business] = plans as [HTMLElement, HTMLElement, HTMLElement];
    expect(within(free).getByText('€0')).toBeInTheDocument();
    expect(within(free).getByText('Current plan')).toBeInTheDocument();
    expect(within(pro).getByText('€12')).toBeInTheDocument();
    expect(within(pro).getByText('Recommended')).toBeInTheDocument();
    expect(within(pro).getByRole('button', { name: 'Coming soon' })).toBeDisabled();
    expect(within(business).getByText('€29')).toBeInTheDocument();
    expect(within(business).getByText('Everything in Pro, plus:')).toBeInTheDocument();

    // Nothing is charged, and the page says so.
    expect(screen.getByText(/nothing is charged until then/)).toBeInTheDocument();
  });

  it('compares every feature, with readable names for ticks and dashes', () => {
    render(<PlansPage />, { wrapper: MemoryRouter });

    const table = screen.getByRole('table', { name: 'Compare plans' });
    const viewers = within(table).getByRole('row', { name: /Read-only viewer accounts/ });
    expect(
      within(viewers)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['Not included', 'Not included', 'Included']);
    const imports = within(table).getByRole('row', { name: /CSV and Excel import/ });
    expect(
      within(imports)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['500 rows a month', 'Unlimited', 'Unlimited']);
  });

  it('reads in Bulgarian, with prices in the Bulgarian format', () => {
    useUiStore.setState({ language: 'bg' });
    render(<PlansPage />, { wrapper: MemoryRouter });

    expect(screen.getByRole('heading', { level: 1, name: 'Планове' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Безплатен' })).toBeInTheDocument();
    expect(screen.getByText('12 €')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Очаквайте скоро' })).toHaveLength(2);
  });
});

describe('PlansDialog', () => {
  it('shows the plans and leads on to the full comparison', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Choose a plan' });
    expect(within(dialog).getAllByRole('article')).toHaveLength(3);

    await user.click(within(dialog).getByRole('link', { name: 'Compare all features' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Plans page')).toBeInTheDocument();
  });

  it('closes from its close button', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
