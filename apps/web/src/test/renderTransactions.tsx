import { render } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { restoreSession } from '../api/session';
import { Providers } from '../app/Providers';
import { RequireAuth, RequireBusiness } from '../features/auth/guards';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { TransactionsPage } from '../features/transactions/TransactionsPage';

/** The Dashboard and Transactions pages behind the real guards and providers, signed in through the fake API. */
export function renderTransactions(url = '/transactions') {
  const router = createMemoryRouter(
    [
      {
        element: <RequireAuth />,
        children: [
          {
            element: <RequireBusiness />,
            children: [
              { index: true, element: <DashboardPage /> },
              { path: 'transactions', element: <TransactionsPage /> },
            ],
          },
        ],
      },
      { path: 'login', element: <p>Login</p> },
      { path: 'onboarding', element: <p>Onboarding</p> },
    ],
    { initialEntries: [url] },
  );
  restoreSession();
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );
  return router;
}

/** jsdom lacks the pointer-capture and scrolling APIs Radix menus and selects use. */
export function polyfillRadix() {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
}
