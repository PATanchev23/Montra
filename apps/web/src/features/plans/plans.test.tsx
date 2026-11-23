import type { BillingResponse } from '@montra/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from 'radix-ui';
import { useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUiStore } from '../../stores/ui';
import { PlansDialog } from './PlansDialog';
import { PlansPage } from './PlansPage';

/*
 * The plans UI against each billing state. The billing hooks are stubbed here;
 * the requests behind them are tested end to end in apps/api/test/billing.test.ts.
 */

const billing = vi.hoisted(() => ({
  data: undefined as BillingResponse | undefined,
  checkout: vi.fn(),
  portal: vi.fn(),
}));

vi.mock('../../api/billing', () => ({
  useBilling: () => ({ data: billing.data }),
  useStartCheckout: () => ({
    mutate: billing.checkout,
    isPending: false,
    variables: undefined,
    error: null,
  }),
  useOpenBillingPortal: () => ({
    mutate: billing.portal,
    isPending: false,
    isError: false,
    error: null,
  }),
}));

const state = (overrides: Partial<BillingResponse> = {}): BillingResponse => ({
  plan: 'free',
  status: null,
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null,
  configured: true,
  testMode: true,
  canSubscribe: true,
  canManage: false,
  ...overrides,
});

beforeEach(() => {
  billing.data = state({ configured: false, testMode: false });
  billing.checkout.mockReset();
  billing.portal.mockReset();
});
afterEach(() => useUiStore.setState({ language: 'en' }));

function renderPage(path = '/plans') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PlansPage />
    </MemoryRouter>,
  );
}

function plans() {
  const cards = within(screen.getByRole('list', { name: 'Plans' })).getAllByRole('article');
  return cards as [HTMLElement, HTMLElement, HTMLElement];
}

describe('PlansPage before Stripe is set up', () => {
  it('shows the three plans, with Free current and the paid plans not yet on sale', () => {
    renderPage();

    const [free, pro, business] = plans();
    expect(
      [free, pro, business].map((plan) => within(plan).getByRole('heading').textContent),
    ).toEqual(['Free', 'Pro', 'Business']);
    expect(within(free).getByText('€0')).toBeInTheDocument();
    expect(within(free).getByText('Current plan')).toBeInTheDocument();
    expect(within(pro).getByText('€12')).toBeInTheDocument();
    expect(within(pro).getByText('Recommended')).toBeInTheDocument();
    expect(within(pro).getByRole('button', { name: 'Coming soon' })).toBeDisabled();
    expect(within(business).getByText('€29')).toBeInTheDocument();
    expect(within(business).getByText('Everything in Pro, plus:')).toBeInTheDocument();
    expect(screen.getByText(/nothing is charged until then/)).toBeInTheDocument();
  });

  it('compares every feature, with readable names for ticks and dashes', () => {
    renderPage();

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
    renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Правилният план за вашия бизнес.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Безплатен' })).toBeInTheDocument();
    expect(screen.getByText('12 €')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Очаквайте скоро' })).toHaveLength(2);
  });
});

describe('PlansPage with Stripe', () => {
  it('lets an owner on Free upgrade through Stripe Checkout', async () => {
    billing.data = state();
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByText(/test mode, so no real money moves/)).toBeInTheDocument();
    const [, pro, business] = plans();
    await user.click(within(pro).getByRole('button', { name: 'Upgrade to Pro' }));
    expect(billing.checkout).toHaveBeenCalledWith('pro');
    await user.click(within(business).getByRole('button', { name: 'Upgrade to Business' }));
    expect(billing.checkout).toHaveBeenCalledWith('business');
    expect(screen.queryByRole('button', { name: 'Manage billing' })).not.toBeInTheDocument();
  });

  it('tells a viewer that only owners can change the plan', () => {
    billing.data = state({ canSubscribe: false });
    renderPage();

    expect(screen.getByText(/Only business owners can change the plan/)).toBeInTheDocument();
    const [, pro] = plans();
    expect(within(pro).getByRole('button', { name: 'Upgrade to Pro' })).toBeDisabled();
  });

  it('shows a subscriber their plan, its renewal, and the way to change it', async () => {
    billing.data = state({
      plan: 'pro',
      status: 'active',
      currentPeriodEnd: '2026-12-23T10:00:00.000Z',
      canManage: true,
    });
    const user = userEvent.setup();
    renderPage();

    const [free, pro, business] = plans();
    expect(within(pro).getByText('Current plan')).toBeInTheDocument();
    expect(within(pro).getByText('Renews on 23 Dec 2026')).toBeInTheDocument();
    expect(within(free).queryByText('Current plan')).not.toBeInTheDocument();

    await user.click(within(business).getByRole('button', { name: 'Change plan' }));
    await user.click(screen.getByRole('button', { name: 'Manage billing' }));
    expect(billing.portal).toHaveBeenCalledTimes(2);
  });

  it('warns when a subscription is ending or its payment failed', () => {
    billing.data = state({
      plan: 'business',
      status: 'active',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: '2026-12-23T10:00:00.000Z',
      canManage: true,
    });
    const { unmount } = renderPage();
    expect(within(plans()[2]).getByText('Ends on 23 Dec 2026')).toBeInTheDocument();
    unmount();

    billing.data = state({ plan: 'business', status: 'past_due', canManage: true });
    renderPage();
    expect(within(plans()[2]).getByText(/Your last payment failed/)).toBeInTheDocument();
  });

  it('confirms a checkout only once Stripe has', () => {
    billing.data = state();
    const { unmount } = renderPage('/plans?checkout=success');
    expect(screen.getByRole('status')).toHaveTextContent('Confirming your payment with Stripe');
    unmount();

    billing.data = state({ plan: 'pro', status: 'active', canManage: true });
    renderPage('/plans?checkout=success');
    expect(screen.getByRole('status')).toHaveTextContent('You’re on Pro. Thank you!');
  });

  it('says a cancelled checkout charged nothing, and can be dismissed', async () => {
    billing.data = state();
    const user = userEvent.setup();
    renderPage('/plans?checkout=cancelled');

    expect(screen.getByRole('status')).toHaveTextContent('You haven’t been charged');
    await user.click(within(screen.getByRole('status')).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

function DialogHarness() {
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

describe('PlansDialog', () => {
  it('shows the plans and leads on to the full comparison', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DialogHarness />
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
        <DialogHarness />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
