import { healthResponseSchema, type HealthResponse } from '@montra/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

const DB_TIMEOUT_MS = 2000;

export interface HealthRoutesOptions {
  version: string;
}

export const healthRoutes: FastifyPluginAsyncZod<HealthRoutesOptions> = async (
  app,
  { version },
) => {
  app.get(
    '/health',
    {
      schema: {
        tags: ['system'],
        summary: 'Service and database health',
        response: { 200: healthResponseSchema },
      },
    },
    async (): Promise<HealthResponse> => {
      const database = await checkDatabase();
      return {
        status: database.status === 'up' ? 'ok' : 'degraded',
        version,
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
        checks: { database },
      };
    },
  );

  async function checkDatabase(): Promise<HealthResponse['checks']['database']> {
    const started = performance.now();
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        app.db.$queryRaw`SELECT 1`,
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Database health check timed out')),
            DB_TIMEOUT_MS,
          );
        }),
      ]);
      return { status: 'up', latencyMs: Math.round(performance.now() - started) };
    } catch (err) {
      app.log.warn({ err }, 'Database health check failed');
      return { status: 'down', latencyMs: null };
    } finally {
      clearTimeout(timer);
    }
  }
};
