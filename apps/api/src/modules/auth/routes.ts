import {
  API_PREFIX,
  apiErrorSchema,
  AUTH_ERROR_CODES,
  authResponseSchema,
  currentUserResponseSchema,
  loginRequestSchema,
  registerRequestSchema,
  type AuthResponse,
  type CurrentUserResponse,
} from '@montra/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { Env } from '../../config/env';
import { AppError } from '../../lib/app-error';
import { hashPassword } from '../../lib/credentials';
import { authOf } from '../../plugins/auth';
import {
  loadCurrentUser,
  registerUser,
  revokeSession,
  rotateSession,
  startSession,
  verifyCredentials,
  type IssuedSession,
} from './service';

/** Sent only to /api/v1/auth/*, so ordinary API calls never carry the refresh token. */
export const REFRESH_COOKIE = 'montra_refresh';
const REFRESH_COOKIE_PATH = `${API_PREFIX}/auth`;

export interface AuthRoutesOptions {
  env: Env;
}

export const authRoutes: FastifyPluginAsyncZod<AuthRoutesOptions> = async (app, { env }) => {
  const cookieBase = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
  } as const;
  const authLimit = { rateLimit: { max: env.AUTH_RATE_LIMIT_MAX, timeWindow: '1 minute' } };
  const refreshLimit = { rateLimit: { max: env.REFRESH_RATE_LIMIT_MAX, timeWindow: '1 minute' } };
  const errorResponses = {
    400: apiErrorSchema,
    401: apiErrorSchema,
    403: apiErrorSchema,
    429: apiErrorSchema,
  };

  // Hashed once at startup: login checks unknown emails against it, so they
  // cost as much as a wrong password and response times reveal nothing.
  const dummyHash = await hashPassword(randomBytes(32).toString('hex'));

  // These routes all read or set the session cookie. SameSite=Strict already
  // keeps it off cross-site requests; refusing foreign origins is a second line.
  app.addHook('preHandler', async (request) => {
    if (!isTrustedOrigin(request, env.CORS_ORIGINS)) {
      throw new AppError(403, 'FORBIDDEN', 'Requests from this origin are not allowed.');
    }
  });

  const sessionOptions = (request: FastifyRequest) => ({
    refreshTokenTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
    userAgent: request.headers['user-agent'],
  });

  async function respondWithSession(
    reply: FastifyReply,
    session: IssuedSession,
  ): Promise<AuthResponse> {
    reply.setCookie(REFRESH_COOKIE, session.refreshToken, {
      ...cookieBase,
      expires: session.refreshTokenExpiresAt,
    });
    reply.header('cache-control', 'no-store');
    const me = await loadCurrentUser(app.db, session.auth.userId);
    return { ...me, ...app.issueAccessToken(session.auth) };
  }

  function clearRefreshCookie(reply: FastifyReply) {
    reply.clearCookie(REFRESH_COOKIE, cookieBase);
  }

  app.post(
    '/register',
    {
      config: authLimit,
      schema: {
        tags: ['auth'],
        summary: 'Create an account and start a session',
        description:
          'Creates the user and their resumable onboarding. The business is created when onboarding completes.',
        body: registerRequestSchema,
        response: { 201: authResponseSchema, 409: apiErrorSchema, ...errorResponses },
      },
    },
    async (request, reply) => {
      const userId = await registerUser(app.db, request.body);
      const session = await startSession(app.db, userId, sessionOptions(request));
      reply.status(201);
      return respondWithSession(reply, session);
    },
  );

  app.post(
    '/login',
    {
      config: authLimit,
      schema: {
        tags: ['auth'],
        summary: 'Sign in with email and password',
        body: loginRequestSchema,
        response: { 200: authResponseSchema, ...errorResponses },
      },
    },
    async (request, reply) => {
      const userId = await verifyCredentials(app.db, request.body, dummyHash);
      const session = await startSession(app.db, userId, sessionOptions(request));
      return respondWithSession(reply, session);
    },
  );

  app.post(
    '/refresh',
    {
      config: refreshLimit,
      schema: {
        tags: ['auth'],
        summary: 'Exchange the refresh cookie for a new access token',
        description:
          'Rotates the refresh token. Reusing an already-rotated token revokes all of the user’s sessions.',
        response: { 200: authResponseSchema, ...errorResponses },
      },
    },
    async (request, reply) => {
      const token = request.cookies[REFRESH_COOKIE];
      const result = token
        ? await rotateSession(app.db, token, sessionOptions(request))
        : ({ outcome: 'invalid' } as const);

      if (result.outcome === 'rotated') return respondWithSession(reply, result.session);

      if (result.outcome === 'reused') {
        request.log.warn(
          { userId: result.userId, sessionId: result.sessionId },
          'Refresh token reuse detected; revoked all sessions for the user',
        );
      }
      clearRefreshCookie(reply);
      throw new AppError(
        401,
        AUTH_ERROR_CODES.INVALID_REFRESH_TOKEN,
        'Your session has ended. Sign in again.',
      );
    },
  );

  app.post(
    '/logout',
    {
      schema: {
        tags: ['auth'],
        summary: 'End the current session',
        description:
          'Always succeeds and clears the refresh cookie, even if the session had ended.',
        response: { 204: z.null(), 403: apiErrorSchema },
      },
    },
    async (request, reply) => {
      const token = request.cookies[REFRESH_COOKIE];
      if (token) await revokeSession(app.db, token);
      clearRefreshCookie(reply);
      return reply.status(204).send(null);
    },
  );

  app.get(
    '/me',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['auth'],
        summary: 'The signed-in user, their businesses, and onboarding status',
        security: [{ bearerAuth: [] }],
        response: { 200: currentUserResponseSchema, 401: apiErrorSchema },
      },
    },
    async (request): Promise<CurrentUserResponse> =>
      loadCurrentUser(app.db, authOf(request).userId),
  );
};

/** No Origin header (curl, server-to-server) is fine; a browser origin must be ours. */
function isTrustedOrigin(request: FastifyRequest, allowed: string[]): boolean {
  const origin = request.headers.origin;
  if (origin === undefined) return true;
  if (allowed.includes(origin)) return true;
  try {
    return new URL(origin).host === request.host;
  } catch {
    return false;
  }
}
