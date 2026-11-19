import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createMemoryRouter, Outlet } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { restoreSession } from '../api/session';
import { Providers } from '../app/Providers';
import { RequireAuth, RequireBusiness } from '../features/auth/guards';
import { BudgetsPage } from '../features/budgets/BudgetsPage';
import { CashFlowPage } from '../features/cashflow/CashFlowPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { SimulationsPage } from '../features/simulations/SimulationsPage';
import { TransactionsPage } from '../features/transactions/TransactionsPage';

/**
 * The Dashboard and Transactions pages (and the pages that still run on the
 * TechStore sample layer) behind the real guards and providers,
 * signed in through the fake API. `chrome` renders above the page, inside the
 * guards, for controls that live in the app shell (the date-range menu).
 */
export function renderTransactions(url = '/transactions', chrome?: ReactNode) {
  const router = createMemoryRouter(
    [
      {
        element: <RequireAuth />,
        children: [
          {
            element: <RequireBusiness />,
            children: [
              {
                element: (
                  <>
                    {chrome}
                    <Outlet />
                  </>
                ),
                children: [
                  { index: true, element: <DashboardPage /> },
                  { path: 'transactions', element: <TransactionsPage /> },
                  { path: 'cash-flow', element: <CashFlowPage /> },
                  { path: 'budgets', element: <BudgetsPage /> },
                  { path: 'simulations', element: <SimulationsPage /> },
                  { path: 'reports', element: <ReportsPage /> },
                ],
              },
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
