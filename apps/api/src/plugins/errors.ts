import type { ApiErrorBody } from '@montra/shared';
import type { FastifyError } from 'fastify';
import fp from 'fastify-plugin';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { STATUS_CODES } from 'node:http';

/** Turns an HTTP status into a stable, machine-readable code, e.g. 404 → NOT_FOUND. */
function codeForStatus(status: number): string {
  return (STATUS_CODES[status] ?? 'Error').toUpperCase().replace(/[^A-Z]+/g, '_');
}

/**
 * Gives every failure the same JSON envelope (see ApiErrorBody). Server errors
 * are logged in full but never leak internals to the client.
 */
export const errorsPlugin = fp(
  async (app) => {
    app.setErrorHandler<FastifyError>((error, request, reply) => {
      if (hasZodFastifySchemaValidationErrors(error)) {
        const body: ApiErrorBody = {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'The request is invalid.',
            details: error.validation.map((issue) => ({
              path: issue.instancePath.replace(/^\//, '').replaceAll('/', '.'),
              message: issue.message,
            })),
            requestId: request.id,
          },
        };
        return reply.status(400).send(body);
      }

      const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
      if (status >= 500) request.log.error({ err: error }, 'Unhandled error');

      const body: ApiErrorBody = {
        error: {
          code: status >= 500 ? 'INTERNAL_ERROR' : codeForStatus(status),
          message: status >= 500 ? 'Something went wrong on our side.' : error.message,
          requestId: request.id,
        },
      };
      return reply.status(status).send(body);
    });

    app.setNotFoundHandler((request, reply) => {
      const body: ApiErrorBody = {
        error: {
          code: 'NOT_FOUND',
          message: `Route ${request.method} ${request.url} does not exist.`,
          requestId: request.id,
        },
      };
      return reply.status(404).send(body);
    });
  },
  { name: 'errors' },
);
