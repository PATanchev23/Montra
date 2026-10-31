/* eslint-disable react-refresh/only-export-components -- a test helper, never hot-reloaded */
import { render } from '@testing-library/react';
import { createMemoryRouter, Outlet, useLocation } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { useLogout } from '../api/auth';
import { restoreSession } from '../api/session';
import { Providers } from '../app/Providers';
import { AuthLayout } from '../features/auth/AuthLayout';
import { useSignedInUser } from '../features/auth/currentUser';
import { GuestOnly, RequireAuth, RequireBusiness } from '../features/auth/guards';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { OnboardingPage } from '../features/onboarding/OnboardingPage';

/** Stands in for the financial app: shows where we are and who is signed in. */
function AppPage() {
  const { user } = useSignedInUser();
  const location = useLocation();
  const logout = useLogout();
  return (
    <div>
      <h1>App {location.pathname}</h1>
      <p>Signed in as {user.name}</p>
      <button onClick={() => logout.mutate()}>Sign out</button>
    </div>
  );
}

/** The real guards and pages, with the shell replaced by AppPage. */
export function renderApp(path: string) {
  const router = createMemoryRouter(
    [
      {
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
              { path: 'onboarding', element: <OnboardingPage /> },
              {
                element: <RequireBusiness />,
                children: [
                  { element: <Outlet />, children: [{ path: '*', element: <AppPage /> }] },
                ],
              },
            ],
          },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  restoreSession();
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );
  return router;
}
