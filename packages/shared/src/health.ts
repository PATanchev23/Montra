import { z } from 'zod';

export const dependencyStatusSchema = z.object({
  status: z.enum(['up', 'down']),
  latencyMs: z.number().nullable(),
});

/**
 * Health is always reported with HTTP 200; `status` says whether every
 * dependency is reachable. A database outage degrades the API rather than
 * taking it down, so platform probes should not restart it.
 */
export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  version: z.string(),
  uptimeSeconds: z.number(),
  timestamp: z.iso.datetime(),
  checks: z.object({
    database: dependencyStatusSchema,
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
