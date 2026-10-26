import { hash, verify } from '@node-rs/argon2';

// The password policy and email normalisation are part of the API contract, so
// they live in @montra/shared; re-exported here for server-side callers.
export { normalizeEmail, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@montra/shared';

// argon2id with OWASP's recommended minimum parameters (19 MiB, 2 iterations).
const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

/** Returns false for a wrong password or an unreadable hash, never throws. */
export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}
