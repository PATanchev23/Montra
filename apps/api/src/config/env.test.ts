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

  it('fails fast with a readable message when required config is missing', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
    expect(() => loadEnv({ ...base, PORT: 'abc' })).toThrow(/PORT/);
  });
});
