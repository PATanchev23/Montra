import { z } from 'zod';
import { membershipSummarySchema } from './business';
import { onboardingStatusSchema, onboardingStepSchema } from './onboarding';

export const PASSWORD_MIN_LENGTH = 10;
/** Upper bound keeps hashing cost predictable and blocks oversized-input abuse. */
export const PASSWORD_MAX_LENGTH = 128;
/** The longest address SMTP can deliver to (RFC 5321). */
export const EMAIL_MAX_LENGTH = 254;
export const USER_NAME_MAX_LENGTH = 100;

/** The database only accepts emails in this form (see User_email_normalized_check). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Accepts any casing and surrounding spaces; always yields the normalised form. */
export const emailSchema = z
  .string()
  .overwrite(normalizeEmail)
  .max(EMAIL_MAX_LENGTH, 'Use a shorter email address.')
  .pipe(z.email('Enter a valid email address.'));

/**
 * Rules for choosing a password. Length is the only rule, as NIST SP 800-63B
 * recommends. Passwords are never trimmed: every character counts.
 */
export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters.`);

export const userNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter your name.')
  .max(USER_NAME_MAX_LENGTH, `Use at most ${USER_NAME_MAX_LENGTH} characters.`);

/** Creates the account only; the business is set up afterwards in onboarding. */
export const registerRequestSchema = z.object({
  name: userNameSchema,
  email: emailSchema,
  password: newPasswordSchema,
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  email: emailSchema,
  // Not checked against the current policy, so a policy change never locks
  // existing users out. The cap still bounds hashing work.
  password: z
    .string()
    .min(1, 'Enter your password.')
    .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters.`),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

/** The signed-in user. Never includes the password hash. */
export const authUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

/** GET /auth/me: who is signed in, which businesses they can open, and whether setup is pending. */
export const currentUserResponseSchema = z.object({
  user: authUserSchema,
  memberships: z.array(membershipSummarySchema),
  onboarding: z.object({
    status: onboardingStatusSchema,
    currentStep: onboardingStepSchema,
  }),
});
export type CurrentUserResponse = z.infer<typeof currentUserResponseSchema>;

/**
 * Returned by register, login and refresh. The access token is sent back as
 * `Authorization: Bearer <token>` and kept in memory only. The refresh token
 * never appears in a body: it travels in an httpOnly cookie.
 */
export const authResponseSchema = currentUserResponseSchema.extend({
  accessToken: z.string().min(1),
  accessTokenExpiresAt: z.iso.datetime(),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;
