import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { API_PREFIX } from '@montra/shared';
import Fastify, { type FastifyServerOptions } from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { randomUUID } from 'node:crypto';
import type { Env } from './config/env';
import { healthRoutes } from './modules/health/routes';
import { errorsPlugin } from './plugins/errors';
import { prismaPlugin } from './plugins/prisma';

const VERSION = '0.1.0';

function loggerOptions(env: Env): FastifyServerOptions['logger'] {
  if (env.NODE_ENV === 'test') return false;
  if (env.NODE_ENV === 'development') {
    return {
      level: env.LOG_LEVEL,
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
    };
  }
  return { level: env.LOG_LEVEL };
}

/** Builds a fully configured app without listening, so tests can drive it via `app.inject`. */
export async function buildApp(env: Env) {
  const app = Fastify({
    logger: loggerOptions(env),
    genReqId: (request) => {
      const incoming = request.headers['x-request-id'];
      return typeof incoming === 'string' && incoming.length <= 128 ? incoming : randomUUID();
    },
    trustProxy: env.NODE_ENV === 'production',
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: env.CORS_ORIGINS,
    credentials: true,
    exposedHeaders: ['x-request-id'],
  });
  await app.register(sensible);
  await app.register(errorsPlugin);
  await app.register(prismaPlugin, { databaseUrl: env.DATABASE_URL });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Montra API',
        description: 'Cash-flow management for e-commerce',
        version: VERSION,
      },
    },
    transform: jsonSchemaTransform,
  });
  // staticCSP adds the CSP header swagger-ui needs alongside helmet's defaults.
  await app.register(swaggerUi, { routePrefix: '/api/docs', staticCSP: true });

  await app.register(healthRoutes, { prefix: API_PREFIX, version: VERSION });

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
