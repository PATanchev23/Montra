import { createBrowserRouter, type RouteObject } from 'react-router';
import { AuthLayout } from '../features/auth/AuthLayout';
import { GuestOnly, RequireAuth, RequireBusiness } from '../features/auth/guards';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { AppLoading } from './AppLoading';
import { AppShell } from './AppShell';
import { NotFoundPage } from './NotFoundPage';
import { RouteError } from './RouteError';

/** The financial app's pages, inside the shell (sidebar and top bar). */
const appRoutes: RouteObject[] = [
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
];

/*
 * Sign-in, registration and the dashboard ship in the main bundle; every other
 * page loads on demand. The financial app needs a signed-in user with a
 * business; users without one set it up at /onboarding.
 */
export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    HydrateFallback: AppLoading,
    children: [
      {
        element: <GuestOnly />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              { path: 'login', element: <LoginPage /> },
              { path: 'register', element: <RegisterPage /> },
            ],
          },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            path: 'onboarding',
            lazy: async () => ({
              Component: (await import('../features/onboarding/OnboardingPage')).OnboardingPage,
            }),
          },
          {
            element: <RequireBusiness />,
            children: [{ element: <AppShell />, children: appRoutes }],
          },
        ],
      },
    ],
  },
]);
