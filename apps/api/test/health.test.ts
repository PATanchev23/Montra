import { healthResponseSchema } from '@montra/shared';
import { describe, expect, it } from 'vitest';
import { createTestApp } from './helpers';

describe('GET /api/v1/health', () => {
  it('reports ok when the database is reachable', async () => {
    const app = await createTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    await app.close();

    expect(res.statusCode).toBe(200);
    const body = healthResponseSchema.parse(res.json());
    expect(body.status).toBe('ok');
    expect(body.checks.database.status).toBe('up');
    expect(body.checks.database.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('reports degraded, not an error, when the database is unreachable', async () => {
    const app = await createTestApp({
      DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:1/unreachable',
    });
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    await app.close();

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: 'degraded',
      checks: { database: { status: 'down', latencyMs: null } },
    });
  });

  it('echoes the request id for tracing', async () => {
    const app = await createTestApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { 'x-request-id': 'trace-123' },
    });
    await app.close();

    expect(res.headers['x-request-id']).toBe('trace-123');
  });
});
