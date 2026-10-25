import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { TooltipProvider } from '../../components/ui/Tooltip';
import { TransactionsPage } from './TransactionsPage';

function renderAt(url: string) {
  const router = createMemoryRouter([{ path: '/transactions', element: <TransactionsPage /> }], {
    initialEntries: [url],
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('TransactionsPage', () => {
  it('applies filters from the URL', async () => {
    renderAt('/transactions?category=advertising&range=all');

    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row', { name: /Ads/ });
    expect(rows.length).toBeGreaterThan(0);
    expect(within(table).queryByText('Shopify payout')).toBeNull();
    expect(screen.getByRole('button', { name: /Advertising/ })).toBeInTheDocument();
  });

  it('shows an empty state with a way out when nothing matches', async () => {
    renderAt('/transactions?q=zzzz-no-match');

    expect(await screen.findByText('No transactions match these filters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });
});
