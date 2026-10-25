import { z } from 'zod';

/** Current REST API version prefix. Every resource route lives under it. */
export const API_PREFIX = '/api/v1';

/**
 * Every non-2xx response from the API uses this envelope, so the client can
 * handle errors uniformly regardless of which route produced them.
 */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
});

export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
