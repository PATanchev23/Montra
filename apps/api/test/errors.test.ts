import { apiErrorSchema } from '@montra/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../src/app';
import { createTestApp } from './helpers';

describe('error envelope', () => {
  let app: App;
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  it('returns a structured 404 for unknown routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/nope' });

    expect(res.statusCode).toBe(404);
    const body = apiErrorSchema.parse(res.json());
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.requestId).toBe(res.headers['x-request-id']);
  });

  it('sets security headers and allows only configured origins', async () => {
    const allowed = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { origin: 'http://localhost:5173' },
    });
    const blocked = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { origin: 'https://evil.example' },
    });

    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(allowed.headers['x-content-type-options']).toBe('nosniff');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });
});
