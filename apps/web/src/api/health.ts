import { API_PREFIX, healthResponseSchema, type HealthResponse } from '@montra/shared';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from './client';

export interface HealthSnapshot extends HealthResponse {
  /** Browser → API → browser time, measured client-side. */
  roundTripMs: number;
}

export const healthKeys = { all: ['health'] as const };

export async function fetchHealth(signal?: AbortSignal): Promise<HealthSnapshot> {
  const started = performance.now();
  const health = await apiRequest(`${API_PREFIX}/health`, { schema: healthResponseSchema, signal });
  return { ...health, roundTripMs: Math.round(performance.now() - started) };
}

export function useHealth() {
  return useQuery({
    queryKey: healthKeys.all,
    queryFn: ({ signal }) => fetchHealth(signal),
    refetchInterval: 15_000,
    staleTime: 0,
    retry: false,
  });
}
