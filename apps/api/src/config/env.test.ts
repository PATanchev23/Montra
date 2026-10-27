import { describe, expect, it } from 'vitest';
import { loadEnv } from './env';

const base = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db' };

describe('loadEnv', () => {
  it('applies defaults and splits CORS origins', () => {
    const env = loadEnv({ ...base, CORS_ORIGINS: 'http://a.test, http://b.test,' });
    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.CORS_ORIGINS).toEqual(['http://a.test', 'http://b.test']);
  });

  it('defaults the token lifetimes and rate limits', () => {
    expect(loadEnv(base)).toMatchObject({
      ACCESS_TOKEN_TTL_MINUTES: 15,
      REFRESH_TOKEN_TTL_DAYS: 30,
      AUTH_RATE_LIMIT_MAX: 10,
      REFRESH_RATE_LIMIT_MAX: 30,
    });
    expect(() => loadEnv({ ...base, ACCESS_TOKEN_TTL_MINUTES: '0' })).toThrow(
      /ACCESS_TOKEN_TTL_MINUTES/,
    );
  });

  it('generates a random JWT secret per process outside production', () => {
    const a = loadEnv(base).JWT_SECRET;
    const b = loadEnv({ ...base, JWT_SECRET: '' }).JWT_SECRET;
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(a).not.toBe(b);
    expect(loadEnv({ ...base, JWT_SECRET: 'x'.repeat(40) }).JWT_SECRET).toBe('x'.repeat(40));
  });

  describe('in production', () => {
    const production = { ...base, NODE_ENV: 'production' };
    const strong = 'q7Vh2mR9xKpL4tWz8nYc3bFd6gJs1aEu0iOo5rTy';

    it('requires a JWT secret', () => {
      expect(() => loadEnv(production)).toThrow(/required in production[\s\S]*JWT_SECRET/);
      expect(() => loadEnv({ ...production, JWT_SECRET: '' })).toThrow(/JWT_SECRET/);
    });

    it.each([
      ['too short', 'q7Vh2mR9xKpL4tWz'],
      ['a placeholder', 'change-me-to-a-long-random-production-secret'],
      ['a repeated character', 'a'.repeat(48)],
      ['low in variety', 'abababababababababababababababab'],
    ])('rejects a secret that is %s', (_label, JWT_SECRET) => {
      expect(() => loadEnv({ ...production, JWT_SECRET })).toThrow(/JWT_SECRET/);
    });

    it('accepts a strong secret as given', () => {
      expect(loadEnv({ ...production, JWT_SECRET: strong }).JWT_SECRET).toBe(strong);
    });
  });

  it('fails fast with a readable message when required config is missing', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
    expect(() => loadEnv({ ...base, PORT: 'abc' })).toThrow(/PORT/);
  });
});
