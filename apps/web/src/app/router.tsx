import { createBrowserRouter } from 'react-router';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { AppLoading } from './AppLoading';
import { AppShell } from './AppShell';
import { NotFoundPage } from './NotFoundPage';
import { RouteError } from './RouteError';

/* The dashboard ships in the main bundle; every other page loads on demand. */
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    HydrateFallback: AppLoading,
    children: [
      { index: true, element: <DashboardPage /> },
      {
        path: 'transactions',
        lazy: async () => ({
          Component: (await import('../features/transactions/TransactionsPage')).TransactionsPage,
        }),
      },
      {
        path: 'budgets',
        lazy: async () => ({
          Component: (await import('../features/budgets/BudgetsPage')).BudgetsPage,
        }),
      },
      {
        path: 'cash-flow',
        lazy: async () => ({
          Component: (await import('../features/cashflow/CashFlowPage')).CashFlowPage,
        }),
      },
      {
        path: 'simulations',
        lazy: async () => ({
          Component: (await import('../features/simulations/SimulationsPage')).SimulationsPage,
        }),
      },
      {
        path: 'reports',
        lazy: async () => ({
          Component: (await import('../features/reports/ReportsPage')).ReportsPage,
        }),
      },
      {
        path: 'settings',
        lazy: async () => ({
          Component: (await import('../features/settings/SettingsPage')).SettingsPage,
        }),
      },
      {
        path: 'status',
        lazy: async () => ({
          Component: (await import('../features/status/SystemStatusPage')).SystemStatusPage,
        }),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
