import jwt from '@fastify/jwt';
import { AUTH_ERROR_CODES } from '@montra/shared';
import type { FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { AppError } from '../lib/app-error';

const ISSUER = 'montra-api';
const AUDIENCE = 'montra-web';

export interface AuthContext {
  userId: string;
  sessionId: string;
}

export interface AccessToken {
  accessToken: string;
  accessTokenExpiresAt: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; sid: string };
    user: { sub: string; sid: string };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    /** preHandler that rejects the request unless it carries a valid access token. */
    authenticate: (request: FastifyRequest) => Promise<void>;
    issueAccessToken: (auth: AuthContext) => AccessToken;
  }
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}

export interface AuthPluginOptions {
  secret: string;
  accessTokenTtlMinutes: number;
}

const invalidAccessToken = () =>
  new AppError(401, AUTH_ERROR_CODES.INVALID_ACCESS_TOKEN, 'Sign in to continue.', {
    headers: { 'WWW-Authenticate': 'Bearer' },
  });

/** The authenticated caller; only valid in routes guarded by `app.authenticate`. */
export function authOf(request: FastifyRequest): AuthContext {
  if (!request.auth) throw new Error('Route is missing the app.authenticate preHandler');
  return request.auth;
}

/**
 * Short-lived HS256 access tokens carrying only the user and session ids.
 * Every authenticated request also checks the session row, so logout and
 * theft detection take effect immediately rather than when the token expires.
 */
export const authPlugin = fp<AuthPluginOptions>(
  async (app, { secret, accessTokenTtlMinutes }) => {
    await app.register(jwt, {
      secret,
      sign: {
        algorithm: 'HS256',
        iss: ISSUER,
        aud: AUDIENCE,
        // A string, because @fastify/jwt reads a bare number as seconds.
        expiresIn: `${accessTokenTtlMinutes}m`,
      },
      verify: { algorithms: ['HS256'], allowedIss: ISSUER, allowedAud: AUDIENCE },
    });

    app.decorateRequest('auth', null);

    app.decorate('issueAccessToken', ({ userId, sessionId }: AuthContext): AccessToken => {
      // Never pass per-call options here: @fastify/jwt then drops the defaults
      // above wholesale, including exp, iss and aud.
      const accessToken = app.jwt.sign({ sub: userId, sid: sessionId });
      const { exp } = app.jwt.decode<{ exp: number }>(accessToken)!;
      return { accessToken, accessTokenExpiresAt: new Date(exp * 1000).toISOString() };
    });

    app.decorate('authenticate', async (request: FastifyRequest) => {
      let claims: { sub: string; sid: string };
      try {
        claims = await request.jwtVerify();
      } catch {
        throw invalidAccessToken();
      }
      if (typeof claims.sub !== 'string' || typeof claims.sid !== 'string') {
        throw invalidAccessToken();
      }

      const session = await app.db.session.findUnique({
        where: { id: claims.sid },
        select: { userId: true, revokedAt: true, expiresAt: true },
      });
      if (
        !session ||
        session.userId !== claims.sub ||
        session.revokedAt ||
        session.expiresAt <= new Date()
      ) {
        throw invalidAccessToken();
      }
      request.auth = { userId: claims.sub, sessionId: claims.sid };
    });
  },
  { name: 'auth', dependencies: ['prisma'] },
);
