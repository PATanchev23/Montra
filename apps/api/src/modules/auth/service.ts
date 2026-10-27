import {
  AUTH_ERROR_CODES,
  currencySchema,
  type CurrentUserResponse,
  type LoginRequest,
  type RegisterRequest,
} from '@montra/shared';
import type { Db } from '../../db';
import { Prisma } from '../../generated/prisma/client';
import { AppError } from '../../lib/app-error';
import { hashPassword, verifyPassword } from '../../lib/credentials';
import { createRefreshToken, hashRefreshToken } from '../../lib/tokens';
import type { AuthContext } from '../../plugins/auth';
import { onboardingSummary } from '../onboarding/status';

const DAY_MS = 86_400_000;
const USER_AGENT_MAX_LENGTH = 512;

export interface SessionOptions {
  refreshTokenTtlDays: number;
  userAgent: string | undefined;
}

export interface IssuedSession {
  auth: AuthContext;
  /** The raw token: goes into the cookie only, never into the database or a log. */
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export type RotationResult =
  | { outcome: 'rotated'; session: IssuedSession }
  | { outcome: 'invalid' }
  /** An already-revoked token came back: it was stolen or replayed. */
  | { outcome: 'reused'; userId: string; sessionId: string };

/** Creates the account and its resumable onboarding. The business comes later, from onboarding. */
export async function registerUser(db: Db, input: RegisterRequest): Promise<string> {
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await db.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
        onboarding: { create: {} },
      },
      select: { id: true },
    });
    return user.id;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(
        409,
        AUTH_ERROR_CODES.EMAIL_TAKEN,
        'An account with this email already exists.',
      );
    }
    throw err;
  }
}

/**
 * Returns the user id for valid credentials. Unknown emails are checked
 * against `dummyHash` so both failures take the same time and look identical.
 */
export async function verifyCredentials(
  db: Db,
  { email, password }: LoginRequest,
  dummyHash: string,
): Promise<string> {
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });
  const valid = await verifyPassword(user?.passwordHash ?? dummyHash, password);
  if (!user || !valid) {
    throw new AppError(401, AUTH_ERROR_CODES.INVALID_CREDENTIALS, 'Incorrect email or password.');
  }
  return user.id;
}

/** Starts a session for a freshly authenticated user, pruning their expired ones. */
export async function startSession(
  db: Db,
  userId: string,
  options: SessionOptions,
): Promise<IssuedSession> {
  await db.session.deleteMany({ where: { userId, expiresAt: { lte: new Date() } } });
  return createSession(db, userId, options);
}

/**
 * Exchanges a refresh token for a new one. Each token works once: rotation
 * revokes the old row, and presenting a revoked token signals theft, so every
 * session the user has is revoked.
 */
export async function rotateSession(
  db: Db,
  refreshToken: string,
  options: SessionOptions,
): Promise<RotationResult> {
  const now = new Date();
  const session = await db.session.findUnique({
    where: { tokenHash: hashRefreshToken(refreshToken) },
    select: { id: true, userId: true, revokedAt: true, expiresAt: true },
  });
  if (!session) return { outcome: 'invalid' };

  const reused = { outcome: 'reused', userId: session.userId, sessionId: session.id } as const;
  if (session.revokedAt) {
    await revokeAllSessions(db, session.userId);
    return reused;
  }
  if (session.expiresAt <= now) return { outcome: 'invalid' };

  const rotated = await db.$transaction(async (tx) => {
    // Conditional on revokedAt still being null, so of two concurrent
    // refreshes with the same token exactly one wins.
    const { count } = await tx.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: now },
    });
    return count === 1 ? createSession(tx, session.userId, options) : null;
  });
  if (!rotated) {
    await revokeAllSessions(db, session.userId);
    return reused;
  }
  return { outcome: 'rotated', session: rotated };
}

/** Ends the session behind a refresh token. Unknown or already-ended tokens are ignored. */
export async function revokeSession(db: Db, refreshToken: string): Promise<void> {
  await db.session.updateMany({
    where: { tokenHash: hashRefreshToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function loadCurrentUser(db: Db, userId: string): Promise<CurrentUserResponse> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      onboarding: { select: { currentStep: true, draft: true, completedAt: true } },
      memberships: {
        orderBy: { createdAt: 'asc' },
        select: {
          role: true,
          business: {
            select: { id: true, slug: true, name: true, currency: true, timezone: true },
          },
        },
      },
    },
  });
  return {
    user: { id: user.id, email: user.email, name: user.name },
    memberships: user.memberships.map(({ role, business }) => ({
      role,
      business: { ...business, currency: currencySchema.parse(business.currency) },
    })),
    onboarding: onboardingSummary(user.onboarding),
  };
}

async function createSession(
  db: Pick<Db, 'session'>,
  userId: string,
  { refreshTokenTtlDays, userAgent }: SessionOptions,
): Promise<IssuedSession> {
  const { token, tokenHash } = createRefreshToken();
  const expiresAt = new Date(Date.now() + refreshTokenTtlDays * DAY_MS);
  const session = await db.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      userAgent: userAgent?.slice(0, USER_AGENT_MAX_LENGTH) ?? null,
    },
    select: { id: true },
  });
  return {
    auth: { userId, sessionId: session.id },
    refreshToken: token,
    refreshTokenExpiresAt: expiresAt,
  };
}

async function revokeAllSessions(db: Db, userId: string): Promise<void> {
  await db.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
