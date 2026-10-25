import { ApiError } from '../../api/client';
import type { HealthSnapshot } from '../../api/health';
import type { Status } from '../../components/ui/StatusDot';

export type Overall = 'checking' | 'operational' | 'degraded' | 'offline';

export interface SystemStatus {
  overall: Overall;
  headline: string;
  api: Status;
  database: Status;
}

/** Maps the latest health query result to what each tier of the stack is doing. */
export function deriveStatus(data: HealthSnapshot | undefined, error: unknown): SystemStatus {
  if (error) {
    const unreachable = !(error instanceof ApiError) || error.status === 0;
    return {
      overall: 'offline',
      headline: unreachable ? 'The API is unreachable' : 'The API is returning errors',
      api: 'down',
      database: 'unknown',
    };
  }
  if (!data) {
    return {
      overall: 'checking',
      headline: 'Checking connections…',
      api: 'unknown',
      database: 'unknown',
    };
  }
  if (data.checks.database.status === 'down') {
    return {
      overall: 'degraded',
      headline: 'The database is unreachable',
      api: 'up',
      database: 'down',
    };
  }
  return { overall: 'operational', headline: 'All systems operational', api: 'up', database: 'up' };
}

export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}
