import { createHash, randomBytes } from 'node:crypto';

/**
 * Refresh tokens are 256 random bits, so a fast unsalted hash is enough to
 * make a leaked Session table useless, and it allows a direct unique lookup.
 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createRefreshToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashRefreshToken(token) };
}
