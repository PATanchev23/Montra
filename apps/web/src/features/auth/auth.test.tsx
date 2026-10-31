import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetSessionForTests } from '../../api/session';
import { useToastStore } from '../../stores/toasts';
import {
  apiError,
  authBody,
  jsonResponse,
  mockApi,
  newProgress,
  noBusiness,
  profile,
} from '../../test/authApi';
import { renderApp } from '../../test/renderApp';

const REFRESH = 'POST /api/v1/auth/refresh';
const LOGIN = 'POST /api/v1/auth/login';
const REGISTER = 'POST /api/v1/auth/register';
const LOGOUT = 'POST /api/v1/auth/logout';
const ME = 'GET /api/v1/auth/me';
const ONBOARDING = 'GET /api/v1/onboarding';

const noSession = () =>
  apiError(401, 'INVALID_REFRESH_TOKEN', 'Your session has ended. Sign in again.');

const user = () => userEvent.setup();

beforeEach(() => {
  resetSessionForTests();
  useToastStore.setState({ toasts: [] });
});
afterEach(() => resetSessionForTests());

describe('protected navigation', () => {
  it('sends a signed-out visitor to sign-in, then back to the page they asked for', async () => {
    const body = authBody();
    const api = mockApi({
      [REFRESH]: noSession,
      [LOGIN]: () => jsonResponse(body),
      [ME]: () => jsonResponse(profile()),
    });
    const router = renderApp('/reports?year=2026');

    expect(await screen.findByRole('heading', { name: 'Sign in to Montra' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');

    const u = user();
    await u.type(screen.getByLabelText('Email'), '  Ana@Example.com ');
    await u.type(screen.getByLabelText('Password'), 'correct horse battery');
    await u.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'App /reports' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?year=2026');
    expect(screen.getByText('Signed in as Ana Petrova')).toBeInTheDocument();
    expect(await screen.findByText('Welcome back, Ana')).toBeInTheDocument();

    // Credentials are sent normalised; /me decides where the user may go.
    expect(JSON.parse(api.calls(LOGIN)[0]![1]!.body as string)).toEqual({
      email: 'ana@example.com',
      password: 'correct horse battery',
    });
    expect(api.authorizationOf(api.calls(ME)[0]!)).toBe(`Bearer ${body.accessToken}`);
  });

  it('restores the session on page load without asking to sign in', async () => {
    mockApi({
      [REFRESH]: () => jsonResponse(authBody()),
      [ME]: () => jsonResponse(profile()),
    });
    renderApp('/budgets');

    expect(await screen.findByRole('heading', { name: 'App /budgets' })).toBeInTheDocument();
  });

  it('sends users without a business to business setup', async () => {
    mockApi({
      [REFRESH]: () => jsonResponse(authBody(profile(noBusiness()))),
      [ME]: () => jsonResponse(profile(noBusiness())),
      [ONBOARDING]: () => jsonResponse(newProgress()),
    });
    const router = renderApp('/');

    expect(
      await screen.findByRole('heading', { name: 'Tell us about your business' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/onboarding');
  });

  it('lets a viewer, who never onboards, into the app', async () => {
    const viewer = profile({
      memberships: [{ ...profile().memberships[0]!, role: 'VIEWER' }],
      onboarding: { status: 'NOT_STARTED', currentStep: 'BUSINESS_DETAILS' },
    });
    mockApi({
      [REFRESH]: () => jsonResponse(authBody(viewer)),
      [ME]: () => jsonResponse(viewer),
    });
    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'App /' })).toBeInTheDocument();
  });

  it('keeps signed-in users away from the sign-in page', async () => {
    mockApi({
      [REFRESH]: () => jsonResponse(authBody()),
      [ME]: () => jsonResponse(profile()),
    });
    renderApp('/login');

    expect(await screen.findByRole('heading', { name: 'App /' })).toBeInTheDocument();
  });

  it('signs out and returns to sign-in with a confirmation', async () => {
    const api = mockApi({
      [REFRESH]: () => jsonResponse(authBody()),
      [ME]: () => jsonResponse(profile()),
      [LOGOUT]: () => new Response(null, { status: 204 }),
    });
    const router = renderApp('/settings');

    await user().click(await screen.findByRole('button', { name: 'Sign out' }));

    expect(await screen.findByText('You’ve signed out.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(api.calls(LOGOUT)).toHaveLength(1);
  });

  it('returns to sign-in with an explanation when the session cannot be refreshed', async () => {
    const refreshes = [() => jsonResponse(authBody(profile(), 1_000)), noSession];
    mockApi({
      [REFRESH]: () => refreshes.shift()!(),
      [ME]: () => jsonResponse(profile()),
    });
    const router = renderApp('/cash-flow');

    // The first token is already inside the expiry margin, so loading /me must refresh.
    expect(
      await screen.findByText('Your session has ended. Sign in again to continue.'),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.state).toMatchObject({ from: { pathname: '/cash-flow' } });
  });

  it('offers a retry when the API is unreachable', async () => {
    const refreshes = [
      () => {
        throw new TypeError('Failed to fetch');
      },
      () => jsonResponse(authBody()),
    ];
    mockApi({
      [REFRESH]: () => refreshes.shift()!(),
      [ME]: () => jsonResponse(profile()),
    });
    renderApp('/');

    await user().click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { name: 'App /' })).toBeInTheDocument();
  });
});

describe('sign-in form', () => {
  it('validates with the shared rules before contacting the API', async () => {
    const api = mockApi({ [REFRESH]: noSession });
    renderApp('/login');

    await user().click(await screen.findByRole('button', { name: 'Sign in' }));

    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveFocus();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(api.calls(LOGIN)).toHaveLength(0);
  });

  it('shows the API’s message for wrong credentials and re-enables the form', async () => {
    mockApi({
      [REFRESH]: noSession,
      [LOGIN]: () => apiError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.'),
    });
    renderApp('/login');
    const u = user();

    await u.type(await screen.findByLabelText('Email'), 'ana@example.com');
    await u.type(screen.getByLabelText('Password'), 'wrong password');
    await u.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('disables the button and shows progress while signing in', async () => {
    let finish: (() => void) | undefined;
    mockApi({
      [REFRESH]: noSession,
      [LOGIN]: async () => {
        await new Promise<void>((resolve) => (finish = resolve));
        return apiError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');
      },
    });
    renderApp('/login');
    const u = user();

    await u.type(await screen.findByLabelText('Email'), 'ana@example.com');
    await u.type(screen.getByLabelText('Password'), 'whatever');
    await u.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('button', { name: 'Signing in…' })).toBeDisabled();
    finish!();
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('toggles password visibility', async () => {
    mockApi({ [REFRESH]: noSession });
    renderApp('/login');
    const password = await screen.findByLabelText('Password');
    const toggle = screen.getByRole('button', { name: 'Show password' });

    expect(password).toHaveAttribute('type', 'password');
    await user().click(toggle);
    expect(password).toHaveAttribute('type', 'text');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('registration form', () => {
  async function fillRegistration(email = 'ana@example.com') {
    const u = user();
    await u.type(await screen.findByLabelText('Full name'), 'Ana Petrova');
    await u.type(screen.getByLabelText('Email'), email);
    await u.type(screen.getByLabelText('Password'), 'correct horse battery');
    await u.click(screen.getByRole('button', { name: 'Create account' }));
    return u;
  }

  it('enforces the password policy from the shared schema', async () => {
    mockApi({ [REFRESH]: noSession });
    renderApp('/register');
    const u = user();

    await u.type(await screen.findByLabelText('Password'), 'short');
    expect(screen.getByText('5 more characters to go.')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText('Use at least 10 characters.')).toBeInTheDocument();
    expect(screen.getByText('Enter your name.')).toBeInTheDocument();
  });

  it('creates the account and continues to business setup', async () => {
    const created = profile(noBusiness());
    const api = mockApi({
      [REFRESH]: noSession,
      [REGISTER]: () => jsonResponse(authBody(created), 201),
      [ME]: () => jsonResponse(created),
      [ONBOARDING]: () => jsonResponse(newProgress()),
    });
    const router = renderApp('/register');

    await fillRegistration();

    expect(
      await screen.findByRole('heading', { name: 'Tell us about your business' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Welcome, Ana\./)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/onboarding');
    expect(await screen.findByText('Account created')).toBeInTheDocument();
    expect(JSON.parse(api.calls(REGISTER)[0]![1]!.body as string)).toEqual({
      name: 'Ana Petrova',
      email: 'ana@example.com',
      password: 'correct horse battery',
    });
  });

  it('flags a taken email on the field until it is changed', async () => {
    mockApi({
      [REFRESH]: noSession,
      [REGISTER]: () => apiError(409, 'EMAIL_TAKEN', 'An account with this email already exists.'),
    });
    renderApp('/register');

    const u = await fillRegistration();

    const email = screen.getByLabelText('Email');
    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByText('An account with this email already exists.')).toBeInTheDocument();

    await u.type(email, 'x');
    expect(email).not.toHaveAttribute('aria-invalid');
  });
});
