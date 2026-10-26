import { describe, expect, it } from 'vitest';
import {
  authResponseSchema,
  currentUserResponseSchema,
  emailSchema,
  loginRequestSchema,
  newPasswordSchema,
  normalizeEmail,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  registerRequestSchema,
} from './auth';

const validRegistration = {
  name: 'Ana Petrova',
  email: 'ana@example.com',
  password: 'correct horse battery',
};

const me = {
  user: { id: 'usr_1', email: 'ana@example.com', name: 'Ana Petrova' },
  memberships: [
    {
      role: 'OWNER',
      business: {
        id: 'biz_1',
        slug: 'techstore',
        name: 'TechStore',
        currency: 'EUR',
        timezone: 'Europe/Sofia',
      },
    },
  ],
  onboarding: { status: 'COMPLETED', currentStep: 'REVIEW' },
};

function issuePaths(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
  return result.error?.issues.map((issue) => issue.path.join('.')) ?? [];
}

describe('emailSchema', () => {
  it('normalises case and surrounding whitespace, like normalizeEmail', () => {
    expect(emailSchema.parse('  Ana.Petrova@Example.COM ')).toBe('ana.petrova@example.com');
    expect(normalizeEmail('  Ana.Petrova@Example.COM ')).toBe('ana.petrova@example.com');
  });

  it.each(['', '   ', 'ana', 'ana@', '@example.com', 'ana@example', 'ana @example.com'])(
    'rejects %j',
    (email) => {
      expect(emailSchema.safeParse(email).success).toBe(false);
    },
  );

  it('rejects addresses longer than 254 characters', () => {
    const email = `${'a'.repeat(64)}@${'b'.repeat(185)}.com`;
    expect(email).toHaveLength(254);
    expect(emailSchema.safeParse(email).success).toBe(true);
    expect(emailSchema.safeParse(`a${email}`).success).toBe(false);
  });
});

describe('newPasswordSchema', () => {
  it('enforces the length bounds exactly', () => {
    expect(newPasswordSchema.safeParse('x'.repeat(PASSWORD_MIN_LENGTH - 1)).success).toBe(false);
    expect(newPasswordSchema.safeParse('x'.repeat(PASSWORD_MIN_LENGTH)).success).toBe(true);
    expect(newPasswordSchema.safeParse('x'.repeat(PASSWORD_MAX_LENGTH)).success).toBe(true);
    expect(newPasswordSchema.safeParse('x'.repeat(PASSWORD_MAX_LENGTH + 1)).success).toBe(false);
  });

  it('keeps surrounding whitespace, which is part of the password', () => {
    expect(newPasswordSchema.parse('  ten chars  ')).toBe('  ten chars  ');
  });
});

describe('registerRequestSchema', () => {
  it('accepts a valid registration and normalises it', () => {
    expect(
      registerRequestSchema.parse({
        ...validRegistration,
        name: '  Ana Petrova ',
        email: ' ANA@Example.com',
      }),
    ).toEqual(validRegistration);
  });

  it('does not ask for a business: that comes later in onboarding', () => {
    const parsed = registerRequestSchema.parse({ ...validRegistration, businessName: 'Shop' });
    expect(parsed).not.toHaveProperty('businessName');
  });

  it('reports each invalid field', () => {
    const result = registerRequestSchema.safeParse({
      name: '   ',
      email: 'nope',
      password: 'short',
    });
    expect(issuePaths(result).sort()).toEqual(['email', 'name', 'password']);
  });

  it('requires every field', () => {
    expect(issuePaths(registerRequestSchema.safeParse({})).sort()).toEqual([
      'email',
      'name',
      'password',
    ]);
  });

  it('rejects names over 100 characters', () => {
    const result = registerRequestSchema.safeParse({ ...validRegistration, name: 'a'.repeat(101) });
    expect(issuePaths(result)).toEqual(['name']);
  });
});

describe('loginRequestSchema', () => {
  it('normalises the email', () => {
    expect(loginRequestSchema.parse({ email: ' Ana@Example.com ', password: 'x' })).toEqual({
      email: 'ana@example.com',
      password: 'x',
    });
  });

  it('does not apply the new-password policy, so policy changes never lock users out', () => {
    expect(
      loginRequestSchema.safeParse({ email: 'ana@example.com', password: 'short' }).success,
    ).toBe(true);
  });

  it('rejects an empty or oversized password', () => {
    for (const password of ['', 'x'.repeat(PASSWORD_MAX_LENGTH + 1)]) {
      const result = loginRequestSchema.safeParse({ email: 'ana@example.com', password });
      expect(issuePaths(result)).toEqual(['password']);
    }
  });
});

describe('currentUserResponseSchema', () => {
  it('accepts a signed-in owner', () => {
    expect(currentUserResponseSchema.parse(me)).toEqual(me);
  });

  it('accepts a new user with no business who has not started onboarding', () => {
    const fresh = {
      ...me,
      memberships: [],
      onboarding: { status: 'NOT_STARTED', currentStep: 'BUSINESS_DETAILS' },
    };
    expect(currentUserResponseSchema.safeParse(fresh).success).toBe(true);
  });

  it('rejects unknown roles and onboarding states', () => {
    const badRole = { ...me, memberships: [{ ...me.memberships[0], role: 'ADMIN' }] };
    expect(currentUserResponseSchema.safeParse(badRole).success).toBe(false);

    const badStatus = { ...me, onboarding: { status: 'DONE', currentStep: 'REVIEW' } };
    expect(currentUserResponseSchema.safeParse(badStatus).success).toBe(false);
  });

  it('never carries the password hash to the client', () => {
    const leaked = { ...me, user: { ...me.user, passwordHash: '$argon2id$...' } };
    expect(currentUserResponseSchema.parse(leaked).user).not.toHaveProperty('passwordHash');
  });
});

describe('authResponseSchema', () => {
  const auth = {
    ...me,
    accessToken: 'eyJ.payload.sig',
    accessTokenExpiresAt: '2026-10-26T12:15:00.000Z',
  };

  it('accepts the current user plus an access token', () => {
    expect(authResponseSchema.parse(auth)).toEqual(auth);
  });

  it('requires a token and an ISO expiry', () => {
    expect(authResponseSchema.safeParse({ ...auth, accessToken: '' }).success).toBe(false);
    expect(
      authResponseSchema.safeParse({ ...auth, accessTokenExpiresAt: 'tomorrow' }).success,
    ).toBe(false);
  });

  it('never carries a refresh token in the body', () => {
    const parsed = authResponseSchema.parse({ ...auth, refreshToken: 'secret' });
    expect(parsed).not.toHaveProperty('refreshToken');
  });
});
