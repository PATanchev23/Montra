import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetSessionForTests } from '../../api/session';
import { Sidebar } from '../../app/Sidebar';
import { useToastStore } from '../../stores/toasts';
import { useUiStore } from '../../stores/ui';
import { ledgerServer } from '../../test/ledgerApi';
import { polyfillRadix, renderTransactions } from '../../test/renderTransactions';

const corner = {
  role: 'OWNER' as const,
  business: {
    id: 'biz-2',
    slug: 'corner-cafe',
    name: 'Corner Café',
    currency: 'EUR' as const,
    timezone: 'Europe/Sofia',
  },
};

const sidebar = <Sidebar />;
const switcher = (name: string) =>
  screen.findByRole('button', { name: `Business: ${name}. Switch business` });

beforeAll(polyfillRadix);
beforeEach(() => {
  resetSessionForTests();
  useToastStore.setState({ toasts: [] });
  useUiStore.setState({ businessId: null });
});
afterEach(() => resetSessionForTests());

describe('the business switcher', () => {
  it('lists every business and switches between them', async () => {
    ledgerServer({ plan: 'pro', otherBusinesses: [corner] });
    renderTransactions('/settings', sidebar);
    const u = userEvent.setup();

    await u.click(await switcher('TechStore'));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitemradio', { name: /TechStore/ })).toBeChecked();
    // Pro allows three: two owned, so one more can be added.
    expect(within(menu).getByRole('menuitem', { name: /Add business/ })).toHaveTextContent(
      '2 of 3 on your plan',
    );

    await u.click(within(menu).getByRole('menuitemradio', { name: /Corner Café/ }));
    expect(await switcher('Corner Café')).toBeInTheDocument();
    expect(useUiStore.getState().businessId).toBe('biz-2');
  });

  it('points a Free account at the plans instead of adding a second business', async () => {
    ledgerServer({ plan: 'free' });
    const router = renderTransactions('/settings', sidebar);
    const u = userEvent.setup();

    await u.click(await switcher('TechStore'));
    const menu = await screen.findByRole('menu');
    expect(within(menu).queryByRole('menuitem', { name: /Add business/ })).not.toBeInTheDocument();
    await u.click(within(menu).getByRole('menuitem', { name: /Add more businesses/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/plans'));
  });

  it('offers a viewer neither adding nor upgrading', async () => {
    ledgerServer({ role: 'VIEWER', plan: 'business' });
    renderTransactions('/settings', sidebar);
    const u = userEvent.setup();

    await u.click(await switcher('TechStore'));
    const menu = await screen.findByRole('menu');
    expect(within(menu).queryByRole('menuitem', { name: /Add business/ })).not.toBeInTheDocument();
    expect(
      within(menu).queryByRole('menuitem', { name: /Add more businesses/ }),
    ).not.toBeInTheDocument();
  });
});

describe('adding a business', () => {
  it('creates it from the onboarding questions and opens it', async () => {
    const api = ledgerServer({ plan: 'pro' });
    const router = renderTransactions('/businesses/new', sidebar);
    const u = userEvent.setup();

    expect(
      await screen.findByText('You own 1 of the 3 businesses your plan includes.'),
    ).toBeInTheDocument();
    await u.type(screen.getByLabelText('Business name'), 'Corner Café');
    await u.click(screen.getByRole('button', { name: 'Create business' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(api.bodies('POST', /\/businesses$/)).toEqual([
      expect.objectContaining({
        businessDetails: expect.objectContaining({ name: 'Corner Café', currency: 'EUR' }),
      }),
    ]);
    // The new business is the one on screen now.
    expect(await switcher('Corner Café')).toBeInTheDocument();
    expect(await screen.findByText('Corner Café is ready')).toBeInTheDocument();
  });

  it('asks for a name before creating anything', async () => {
    const api = ledgerServer({ plan: 'business' });
    renderTransactions('/businesses/new');
    const u = userEvent.setup();

    await u.click(await screen.findByRole('button', { name: 'Create business' }));
    expect(screen.getByLabelText('Business name')).toHaveFocus();
    expect(api.bodies('POST', /\/businesses$/)).toEqual([]);
  });

  it('explains the limit instead of the form when the plan is full', async () => {
    ledgerServer({ plan: 'free' });
    renderTransactions('/businesses/new');

    expect(
      await screen.findByText('You have reached your plan’s business limit'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Your plan includes one business. Pro includes up to 3, and Business up to 5.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See plans' })).toHaveAttribute('href', '/plans');
    expect(screen.queryByRole('button', { name: 'Create business' })).not.toBeInTheDocument();
  });
});
