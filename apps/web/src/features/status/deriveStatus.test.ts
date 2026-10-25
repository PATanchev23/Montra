import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api/client';
import type { HealthSnapshot } from '../../api/health';
import { deriveStatus, formatUptime } from './deriveStatus';

const healthy: HealthSnapshot = {
  status: 'ok',
  version: '0.1.0',
  uptimeSeconds: 42,
  timestamp: '2026-10-25T12:00:00.000Z',
  checks: { database: { status: 'up', latencyMs: 2 } },
  roundTripMs: 9,
};

describe('deriveStatus', () => {
  it('is checking before the first response', () => {
    expect(deriveStatus(undefined, null).overall).toBe('checking');
  });

  it('is operational when the API and database are up', () => {
    expect(deriveStatus(healthy, null)).toMatchObject({
      overall: 'operational',
      api: 'up',
      database: 'up',
    });
  });

  it('is degraded when only the database is down', () => {
    const data: HealthSnapshot = {
      ...healthy,
      status: 'degraded',
      checks: { database: { status: 'down', latencyMs: null } },
    };
    expect(deriveStatus(data, null)).toMatchObject({
      overall: 'degraded',
      api: 'up',
      database: 'down',
    });
  });

  it('is offline when the API cannot be reached, even with stale data', () => {
    const status = deriveStatus(healthy, new ApiError(0, 'NETWORK_ERROR', 'down'));
    expect(status).toMatchObject({ overall: 'offline', api: 'down', database: 'unknown' });
    expect(status.headline).toMatch(/unreachable/);
  });
});

describe('formatUptime', () => {
  it('uses the two most significant units', () => {
    expect(formatUptime(12)).toBe('12s');
    expect(formatUptime(125)).toBe('2m');
    expect(formatUptime(3 * 3600 + 12 * 60)).toBe('3h 12m');
    expect(formatUptime(2 * 86_400 + 5 * 3600)).toBe('2d 5h');
  });
});
