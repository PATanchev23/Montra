import {
  onboardingSubmissionSchema,
  saveOnboardingRequestSchema,
  type OnboardingDraft,
  type OnboardingProgress,
} from '@montra/shared';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetSessionForTests } from '../../api/session';
import { useToastStore } from '../../stores/toasts';
import {
  apiError,
  authBody,
  jsonResponse,
  mockApi,
  newProgress,
  profile,
} from '../../test/authApi';
import { renderApp } from '../../test/renderApp';
import { defaultTimeZone } from './draft';

const REFRESH = 'POST /api/v1/auth/refresh';
const ME = 'GET /api/v1/auth/me';
const PROGRESS = 'GET /api/v1/onboarding';
const SAVE = 'PUT /api/v1/onboarding';
const COMPLETE = 'POST /api/v1/onboarding/complete';

type Handler = (init: RequestInit) => Response | Promise<Response>;

const completeDraft: OnboardingDraft = {
  businessDetails: {
    name: 'TechStore',
    industry: 'Consumer electronics',
    currency: 'EUR',
    timezone: 'Europe/Sofia',
  },
  financialPreferences: { fiscalYearStartMonth: 4, lowBalanceThresholdCents: 250_000 },
};

/**
 * A stand-in for the onboarding API that keeps progress between requests, as
 * the database does, and validates with the same shared schemas.
 */
function onboardingServer(initial: OnboardingProgress = newProgress()) {
  let progress = initial;

  const me = () =>
    progress.status === 'COMPLETED'
      ? profile()
      : profile({
          memberships: [],
          onboarding: { status: progress.status, currentStep: progress.currentStep },
        });

  const server = {
    get progress() {
      return progress;
    },
    set progress(next: OnboardingProgress) {
      progress = next;
    },
    routes: {
      [REFRESH]: () => jsonResponse(authBody(me())),
      [ME]: () => jsonResponse(me()),
      [PROGRESS]: () => jsonResponse(progress),
      [SAVE]: (init) => {
        const parsed = saveOnboardingRequestSchema.safeParse(JSON.parse(init.body as string));
        if (!parsed.success) return apiError(400, 'VALIDATION_ERROR', 'Invalid request.');
        progress = { ...progress, status: 'IN_PROGRESS', ...parsed.data };
        return jsonResponse(progress);
      },
      [COMPLETE]: () => {
        const submission = onboardingSubmissionSchema.safeParse(progress.draft);
        if (!submission.success) {
          return apiError(422, 'ONBOARDING_INCOMPLETE', 'Some details are missing.');
        }
        server.finish();
        const { name, currency, timezone } = submission.data.businessDetails;
        return jsonResponse(
          {
            onboarding: progress,
            membership: {
              role: 'OWNER',
              business: { id: 'biz-1', slug: 'techstore', name, currency, timezone },
            },
          },
          201,
        );
      },
    } as Record<string, Handler>,
    finish() {
      progress = {
        ...progress,
        status: 'COMPLETED',
        currentStep: 'REVIEW',
        completedAt: new Date().toISOString(),
        businessId: 'biz-1',
      };
    },
  };
  return server;
}

const atReview = (draft: OnboardingDraft = completeDraft) =>
  newProgress({ status: 'IN_PROGRESS', currentStep: 'REVIEW', draft });

const bodyOf = (call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string);

const user = () => userEvent.setup();

beforeAll(() => {
  // jsdom lacks the pointer-capture and scrolling APIs Radix Select uses.
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

beforeEach(() => {
  resetSessionForTests();
  useToastStore.setState({ toasts: [] });
});
afterEach(() => resetSessionForTests());

describe('starting and resuming', () => {
  it('starts a new user at business details, with defaults filled in', async () => {
    const api = mockApi(onboardingServer().routes);
    renderApp('/onboarding');

    expect(
      await screen.findByRole('heading', { name: 'Tell us about your business' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Welcome, Ana\./)).toBeInTheDocument();
    expect(screen.getByText('Business setup · Step 1 of 3')).toBeInTheDocument();
    const progress = screen.getByRole('list', { name: 'Setup progress' });
    expect(within(progress).getByText('Business').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByLabelText('Business name')).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Currency' })).toHaveTextContent('Euro (EUR)');
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
    expect(api.calls(PROGRESS)).toHaveLength(1);
  });

  it('resumes a saved draft at the saved step', async () => {
    const api = mockApi(
      onboardingServer(
        newProgress({
          status: 'IN_PROGRESS',
          currentStep: 'FINANCIAL_PREFERENCES',
          draft: completeDraft,
        }),
      ).routes,
    );
    renderApp('/onboarding');

    expect(
      await screen.findByRole('heading', { name: 'Financial preferences' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Business setup · Step 2 of 3')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Financial year starts in' })).toHaveTextContent(
      'April',
    );
    expect(screen.getByLabelText('Low-balance threshold in EUR (optional)')).toHaveValue('2500');
    expect(screen.getByText('Progress saved')).toBeInTheDocument();

    // Back moves without saving; the earlier answers are all there.
    await user().click(screen.getByRole('button', { name: 'Back' }));
    expect(
      await screen.findByRole('heading', { name: 'Tell us about your business' }),
    ).toHaveFocus();
    expect(screen.getByLabelText('Business name')).toHaveValue('TechStore');
    expect(screen.getByLabelText('Industry (optional)')).toHaveValue('Consumer electronics');
    expect(api.calls(SAVE)).toHaveLength(0);
  });

  it('restores progress after a reload, from the API rather than the page', async () => {
    const server = onboardingServer();
    mockApi(server.routes);
    renderApp('/onboarding');
    const u = user();

    await u.type(await screen.findByLabelText('Business name'), 'TechStore');
    await u.click(screen.getByRole('button', { name: 'Continue' }));
    await u.type(await screen.findByLabelText('Low-balance threshold in EUR (optional)'), '1500');
    await u.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Review and create' })).toBeInTheDocument();

    // A reload: nothing survives in memory, only what the API saved.
    cleanup();
    resetSessionForTests();
    mockApi(server.routes);
    renderApp('/onboarding');

    expect(await screen.findByRole('heading', { name: 'Review and create' })).toBeInTheDocument();
    expect(screen.getByText('TechStore')).toBeInTheDocument();
    expect(screen.getByText('€1,500.00')).toBeInTheDocument();
    expect(screen.getByText('January')).toBeInTheDocument();
  });

  it('offers a retry when progress cannot be loaded', async () => {
    const server = onboardingServer();
    const loads = [
      () => apiError(429, 'RATE_LIMITED', 'Too many requests.'),
      server.routes[PROGRESS]!,
    ];
    mockApi({ ...server.routes, [PROGRESS]: (init) => loads.shift()!(init) });
    renderApp('/onboarding');

    expect(await screen.findByText('Could not load your business setup')).toBeInTheDocument();
    await user().click(screen.getByRole('button', { name: 'Try again' }));

    expect(
      await screen.findByRole('heading', { name: 'Tell us about your business' }),
    ).toBeInTheDocument();
  });
});

describe('moving between steps', () => {
  it('saves the answers on Continue, then moves on', async () => {
    const server = onboardingServer();
    const api = mockApi(server.routes);
    renderApp('/onboarding');
    const u = user();

    await u.type(await screen.findByLabelText('Business name'), '  TechStore ');
    await u.type(screen.getByLabelText('Industry (optional)'), 'Consumer electronics');
    await u.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('heading', { name: 'Financial preferences' })).toHaveFocus();
    expect(api.calls(SAVE)).toHaveLength(1);
    expect(bodyOf(api.calls(SAVE)[0]!)).toEqual({
      currentStep: 'FINANCIAL_PREFERENCES',
      draft: {
        businessDetails: {
          name: 'TechStore',
          industry: 'Consumer electronics',
          currency: 'EUR',
          timezone: defaultTimeZone(),
        },
        financialPreferences: { fiscalYearStartMonth: 1, lowBalanceThresholdCents: null },
      },
    });
    expect(screen.getByText('Progress saved')).toBeInTheDocument();
    expect(server.progress.currentStep).toBe('FINANCIAL_PREFERENCES');
  });

  it('saves the chosen month and threshold in cents', async () => {
    const api = mockApi(
      onboardingServer(
        newProgress({
          status: 'IN_PROGRESS',
          currentStep: 'FINANCIAL_PREFERENCES',
          draft: { businessDetails: completeDraft.businessDetails },
        }),
      ).routes,
    );
    renderApp('/onboarding');
    const u = user();

    await u.click(await screen.findByRole('combobox', { name: 'Financial year starts in' }));
    await u.click(await screen.findByRole('option', { name: 'July' }));
    await u.type(screen.getByLabelText('Low-balance threshold in EUR (optional)'), '2500,50');
    await u.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('heading', { name: 'Review and create' })).toBeInTheDocument();
    expect(bodyOf(api.calls(SAVE)[0]!).draft.financialPreferences).toEqual({
      fiscalYearStartMonth: 7,
      lowBalanceThresholdCents: 250_050,
    });
    expect(screen.getByText('July')).toBeInTheDocument();
    expect(screen.getByText('€2,500.50')).toBeInTheDocument();
  });

  it('goes back to a step from the review to change it', async () => {
    mockApi(onboardingServer(atReview()).routes);
    renderApp('/onboarding');
    const u = user();

    await u.click(await screen.findByRole('button', { name: 'Edit business details' }));
    const name = await screen.findByLabelText('Business name');
    await u.clear(name);
    await u.type(name, 'TechStore Bulgaria');
    await u.click(screen.getByRole('button', { name: 'Continue' }));
    await u.click(await screen.findByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('TechStore Bulgaria')).toBeInTheDocument();
  });
});

describe('validation', () => {
  it('checks business details with the shared rules before saving', async () => {
    const api = mockApi(onboardingServer().routes);
    renderApp('/onboarding');
    const u = user();

    await u.click(await screen.findByRole('button', { name: 'Continue' }));

    expect(screen.getByText('Enter the business name.')).toBeInTheDocument();
    expect(screen.getByLabelText('Business name')).toHaveFocus();
    expect(screen.getByLabelText('Business name')).toHaveAttribute('aria-invalid', 'true');

    await u.click(screen.getByLabelText('Business name'));
    await u.paste('x'.repeat(101));
    expect(screen.getByText('Use at most 100 characters.')).toBeInTheDocument();
    expect(api.calls(SAVE)).toHaveLength(0);
  });

  it('explains an invalid threshold and keeps the step until it is fixed', async () => {
    const api = mockApi(
      onboardingServer(
        newProgress({
          status: 'IN_PROGRESS',
          currentStep: 'FINANCIAL_PREFERENCES',
          draft: { businessDetails: completeDraft.businessDetails },
        }),
      ).routes,
    );
    renderApp('/onboarding');
    const u = user();
    const threshold = await screen.findByLabelText('Low-balance threshold in EUR (optional)');

    await u.type(threshold, 'lots');
    await u.tab();
    expect(screen.getByText('Enter an amount such as 2500 or 2500.50.')).toBeInTheDocument();

    await u.clear(threshold);
    await u.type(threshold, '-5');
    expect(screen.getByText('The threshold cannot be negative.')).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Continue' }));
    expect(threshold).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'Financial preferences' })).toBeInTheDocument();
    expect(api.calls(SAVE)).toHaveLength(0);
  });
});

describe('saving', () => {
  it('reports a failed save, keeps the answers, and saves on retry', async () => {
    const server = onboardingServer();
    const saves: Handler[] = [
      () => {
        throw new TypeError('Failed to fetch');
      },
      () => apiError(500, 'INTERNAL_ERROR', 'Something went wrong on our side.'),
      server.routes[SAVE]!,
    ];
    const api = mockApi({ ...server.routes, [SAVE]: (init) => saves.shift()!(init) });
    renderApp('/onboarding');
    const u = user();

    await u.type(await screen.findByLabelText('Business name'), 'TechStore');
    await u.click(screen.getByRole('button', { name: 'Continue' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Your progress wasn’t saved.');
    expect(alert).toHaveTextContent('Montra could not be reached.');
    expect(
      screen.getByRole('heading', { name: 'Tell us about your business' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Business name')).toHaveValue('TechStore');
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();

    // Leaving the page now would lose the answers, so the browser asks first.
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);

    await u.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong on our side.');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();

    await u.click(screen.getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByRole('heading', { name: 'Financial preferences' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(api.calls(SAVE)).toHaveLength(3);
  });

  it('sends one save at a time, however often Continue is pressed', async () => {
    const server = onboardingServer();
    let finish: (() => void) | undefined;
    const api = mockApi({
      ...server.routes,
      [SAVE]: async (init) => {
        await new Promise<void>((resolve) => (finish = resolve));
        return server.routes[SAVE]!(init);
      },
    });
    renderApp('/onboarding');
    const u = user();

    await u.type(await screen.findByLabelText('Business name'), 'TechStore');
    const form = screen.getByRole('button', { name: 'Continue' }).closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDisabled();
    await u.click(screen.getByRole('button', { name: 'Saving…' }));
    expect(api.calls(SAVE)).toHaveLength(1);

    finish!();
    expect(
      await screen.findByRole('heading', { name: 'Financial preferences' }),
    ).toBeInTheDocument();
    expect(api.calls(SAVE)).toHaveLength(1);
  });

  it('saves unsaved answers before signing out', async () => {
    const server = onboardingServer();
    const api = mockApi({
      ...server.routes,
      'POST /api/v1/auth/logout': () => new Response(null, { status: 204 }),
    });
    const router = renderApp('/onboarding');
    const u = user();

    await u.type(await screen.findByLabelText('Business name'), 'TechStore');
    await u.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByText('You’ve signed out.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(bodyOf(api.calls(SAVE)[0]!)).toMatchObject({
      currentStep: 'BUSINESS_DETAILS',
      draft: { businessDetails: { name: 'TechStore' } },
    });
  });
});

describe('completing', () => {
  it('creates the business through the API, then opens the dashboard', async () => {
    const server = onboardingServer(atReview());
    const api = mockApi(server.routes);
    const router = renderApp('/onboarding');

    expect(await screen.findByRole('heading', { name: 'Review and create' })).toBeInTheDocument();
    expect(screen.getByText('Consumer electronics')).toBeInTheDocument();
    expect(screen.getByText('€2,500.00')).toBeInTheDocument();

    await user().click(screen.getByRole('button', { name: 'Create business' }));

    expect(await screen.findByRole('heading', { name: 'App /' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(await screen.findByText('Your business is ready')).toBeInTheDocument();
    expect(api.calls(COMPLETE)).toHaveLength(1);
    expect(api.calls(COMPLETE)[0]![1]!.body).toBeUndefined();
    expect(server.progress.status).toBe('COMPLETED');
  });

  it('stays on the review, busy, until the API confirms', async () => {
    const server = onboardingServer(atReview());
    let finish: (() => void) | undefined;
    const api = mockApi({
      ...server.routes,
      [COMPLETE]: async (init) => {
        await new Promise<void>((resolve) => (finish = resolve));
        return server.routes[COMPLETE]!(init);
      },
    });
    const router = renderApp('/onboarding');
    const u = user();

    await u.click(await screen.findByRole('button', { name: 'Create business' }));
    const busy = await screen.findByRole('button', { name: 'Creating business…' });
    expect(busy).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    await u.click(busy);
    expect(router.state.location.pathname).toBe('/onboarding');

    finish!();
    expect(await screen.findByRole('heading', { name: 'App /' })).toBeInTheDocument();
    expect(api.calls(COMPLETE)).toHaveLength(1);
  });

  it('lists missing answers before asking the API, with links to fix them', async () => {
    const api = mockApi(
      onboardingServer(atReview({ businessDetails: { name: 'TechStore', currency: 'EUR' } }))
        .routes,
    );
    renderApp('/onboarding');
    const u = user();

    await u.click(await screen.findByRole('button', { name: 'Create business' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Some required business details are still missing.');
    expect(api.calls(COMPLETE)).toHaveLength(0);

    await u.click(within(alert).getByRole('button', { name: 'Time zone' }));
    expect(
      await screen.findByRole('heading', { name: 'Tell us about your business' }),
    ).toBeInTheDocument();
  });

  it('handles ONBOARDING_INCOMPLETE by reloading the saved answers', async () => {
    const server = onboardingServer(atReview());
    mockApi({
      ...server.routes,
      [COMPLETE]: () => {
        // Another tab cleared the name after this one reached the review.
        server.progress = atReview({
          ...completeDraft,
          businessDetails: { ...completeDraft.businessDetails, name: undefined },
        });
        return jsonResponse(
          {
            error: {
              code: 'ONBOARDING_INCOMPLETE',
              message: 'Some required business details are still missing.',
              details: [{ path: 'businessDetails.name', message: 'Enter the business name.' }],
            },
          },
          422,
        );
      },
    });
    const router = renderApp('/onboarding');
    const u = user();

    await u.click(await screen.findByRole('button', { name: 'Create business' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Some required business details are still missing.');
    expect(await screen.findByText('Missing')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/onboarding');

    await u.click(within(alert).getByRole('button', { name: 'Business name' }));
    expect(await screen.findByLabelText('Business name')).toHaveValue('');
  });

  it('handles ONBOARDING_CHANGED by showing the latest saved answers', async () => {
    const server = onboardingServer(atReview());
    const api = mockApi({
      ...server.routes,
      [COMPLETE]: () => {
        server.progress = atReview({
          ...completeDraft,
          businessDetails: { ...completeDraft.businessDetails, name: 'TechStore Plus' },
        });
        return apiError(
          409,
          'ONBOARDING_CHANGED',
          'Your answers changed while finishing setup. Review them and try again.',
        );
      },
    });
    renderApp('/onboarding');

    await user().click(await screen.findByRole('button', { name: 'Create business' }));

    expect(
      await screen.findByText(
        'Your answers changed while finishing setup. Review them and try again.',
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText('TechStore Plus')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create business' })).toBeEnabled();
    expect(api.calls(PROGRESS).length).toBeGreaterThanOrEqual(2);
  });

  it('handles ONBOARDING_ALREADY_COMPLETED by opening the existing business', async () => {
    const server = onboardingServer(atReview());
    mockApi({
      ...server.routes,
      [COMPLETE]: () => {
        server.finish();
        return apiError(
          409,
          'ONBOARDING_ALREADY_COMPLETED',
          'Your business is already set up. Onboarding cannot be repeated.',
        );
      },
    });
    renderApp('/onboarding');

    await user().click(await screen.findByRole('button', { name: 'Create business' }));

    expect(await screen.findByRole('heading', { name: 'App /' })).toBeInTheDocument();
    expect(await screen.findByText('Your business is already set up')).toBeInTheDocument();
  });
});

describe('who sees onboarding', () => {
  it('sends signed-out visitors to sign in first', async () => {
    mockApi({
      [REFRESH]: () => apiError(401, 'INVALID_REFRESH_TOKEN', 'Sign in again.'),
    });
    const router = renderApp('/onboarding');

    expect(await screen.findByRole('heading', { name: 'Sign in to Montra' })).toBeInTheDocument();
    expect(router.state.location.state).toMatchObject({ from: { pathname: '/onboarding' } });
  });

  it('sends owners who finished setup to the dashboard', async () => {
    const server = onboardingServer();
    server.finish();
    const api = mockApi(server.routes);
    renderApp('/onboarding');

    expect(await screen.findByRole('heading', { name: 'App /' })).toBeInTheDocument();
    expect(api.calls(PROGRESS)).toHaveLength(0);
  });

  it('never makes a viewer onboard, though their status is NOT_STARTED', async () => {
    const viewer = profile({
      memberships: [{ ...profile().memberships[0]!, role: 'VIEWER' }],
      onboarding: { status: 'NOT_STARTED', currentStep: 'BUSINESS_DETAILS' },
    });
    const api = mockApi({
      [REFRESH]: () => jsonResponse(authBody(viewer)),
      [ME]: () => jsonResponse(viewer),
    });
    const router = renderApp('/onboarding');

    expect(await screen.findByRole('heading', { name: 'App /' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    await waitFor(() => expect(api.calls(ME)).toHaveLength(1));
    expect(api.calls(PROGRESS)).toHaveLength(0);
  });
});
