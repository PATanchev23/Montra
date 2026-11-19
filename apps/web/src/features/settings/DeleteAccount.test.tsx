import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetSessionForTests } from '../../api/session';
import { apiError, authBody, jsonResponse, mockApi, profile } from '../../test/authApi';
import { renderApp } from '../../test/renderApp';
import { SettingsPage } from './SettingsPage';

const REFRESH = 'POST /api/v1/auth/refresh';
const ME = 'GET /api/v1/auth/me';
const DELETE_ME = 'DELETE /api/v1/auth/me';
const HEALTH = 'GET /api/v1/health';

const PASSWORD = 'correct horse battery';

beforeEach(() => resetSessionForTests());
afterEach(() => resetSessionForTests());

function setup(deleteMe: () => Response) {
  const body = authBody();
  const api = mockApi({
    [REFRESH]: () => jsonResponse(body),
    [ME]: () => jsonResponse(profile()),
    [HEALTH]: () => apiError(503, 'SERVICE_UNAVAILABLE', 'Unavailable.'),
    [DELETE_ME]: deleteMe,
  });
  const router = renderApp('/settings', <SettingsPage />);
  return { api, router, body };
}

async function openDialog() {
  const u = userEvent.setup();
  await u.click(await screen.findByRole('button', { name: 'Delete account…' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Delete your account?' });
  return { u, dialog };
}

describe('deleting the account', () => {
  it('says what goes with it, including the business the user owns', async () => {
    setup(() => new Response(null, { status: 204 }));
    const { dialog } = await openDialog();

    expect(dialog).toHaveTextContent(/TechStore goes too, with all of its transactions/);
    expect(dialog).toHaveTextContent('This cannot be undone.');
  });

  it('asks for the password before sending anything', async () => {
    const { api } = setup(() => new Response(null, { status: 204 }));
    const { u, dialog } = await openDialog();

    await u.click(within(dialog).getByRole('button', { name: 'Delete account' }));

    expect(within(dialog).getByText('Enter your password.')).toBeInTheDocument();
    expect(api.calls(DELETE_ME)).toHaveLength(0);
  });

  it('shows a wrong password in the dialog and stays signed in', async () => {
    const { router } = setup(() => apiError(403, 'INVALID_PASSWORD', 'Incorrect password.'));
    const { u, dialog } = await openDialog();

    await u.type(within(dialog).getByLabelText('Password'), 'not my password');
    await u.click(within(dialog).getByRole('button', { name: 'Delete account' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Incorrect password.');
    expect(router.state.location.pathname).toBe('/settings');
  });

  it('deletes the account, then signs out to sign-in with a confirmation', async () => {
    const { api, router, body } = setup(() => new Response(null, { status: 204 }));
    const { u, dialog } = await openDialog();

    await u.type(within(dialog).getByLabelText('Password'), PASSWORD);
    await u.click(within(dialog).getByRole('button', { name: 'Delete account' }));

    expect(await screen.findByText('Your account has been deleted.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    // The next sign-in starts fresh rather than returning to settings.
    expect(router.state.location.state).toBeNull();

    const [call] = api.calls(DELETE_ME);
    expect(JSON.parse(call![1]!.body as string)).toEqual({ password: PASSWORD });
    expect(api.authorizationOf(call!)).toBe(`Bearer ${body.accessToken}`);
  });
});
