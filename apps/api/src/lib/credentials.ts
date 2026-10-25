import { hash, verify } from '@node-rs/argon2';

export const PASSWORD_MIN_LENGTH = 10;
/** Upper bound keeps hashing cost predictable and blocks oversized-input abuse. */
export const PASSWORD_MAX_LENGTH = 128;

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

/** The database only accepts emails in this form (see User_email_normalized_check). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
