import { apiErrorSchema } from '@montra/shared';
import type { z } from 'zod';

const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

/** A failed API call. `status` is 0 when the server could not be reached at all. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions<S extends z.ZodType> {
  schema: S;
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

/**
 * Typed fetch for the Montra API. Every response is validated against the
 * shared Zod contract, so a server/client mismatch fails loudly instead of
 * rendering wrong numbers.
 */
export async function apiRequest<S extends z.ZodType>(
  path: string,
  { schema, method = 'GET', body, signal, headers }: RequestOptions<S>,
): Promise<z.output<S>> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      signal,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the Montra API.');
  }

  const payload: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(payload);
    if (parsed.success) {
      const { code, message, requestId, details } = parsed.data.error;
      throw new ApiError(response.status, code, message, requestId, details);
    }
    throw new ApiError(
      response.status,
      'HTTP_ERROR',
      `Request failed with status ${response.status}.`,
    );
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(
      response.status,
      'INVALID_RESPONSE',
      'The API returned an unexpected response.',
    );
  }
  return parsed.data;
}
