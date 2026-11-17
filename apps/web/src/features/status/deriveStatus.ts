import { ApiError } from '../../api/client';
import type { HealthSnapshot } from '../../api/health';
import type { Status } from '../../components/ui/StatusDot';
import { messagesFor } from '../../i18n';
import { statusMessages } from './messages';

export type Overall = 'checking' | 'operational' | 'degraded' | 'offline';

export interface SystemStatus {
  overall: Overall;
  headline: string;
  api: Status;
  database: Status;
}

/** Maps the latest health query result to what each tier of the stack is doing. */
export function deriveStatus(data: HealthSnapshot | undefined, error: unknown): SystemStatus {
  const m = messagesFor(statusMessages).headline;
  if (error) {
    const unreachable = !(error instanceof ApiError) || error.status === 0;
    return {
      overall: 'offline',
      headline: unreachable ? m.unreachable : m.erroring,
      api: 'down',
      database: 'unknown',
    };
  }
  if (!data) {
    return {
      overall: 'checking',
      headline: m.checking,
      api: 'unknown',
      database: 'unknown',
    };
  }
  if (data.checks.database.status === 'down') {
    return {
      overall: 'degraded',
      headline: m.databaseDown,
      api: 'up',
      database: 'down',
    };
  }
  return { overall: 'operational', headline: m.operational, api: 'up', database: 'up' };
}

export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const u = messagesFor(statusMessages).uptime;
  if (d > 0) return u.days(d, h);
  if (h > 0) return u.hours(h, m);
  if (m > 0) return u.minutes(m);
  return u.seconds(seconds);
}
