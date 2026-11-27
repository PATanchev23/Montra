import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildApp } from './app';
import { loadEnv } from './config/env';

/*
 * The API as one Vercel Function (api/index.js re-exports this bundle). Vercel
 * always runs it as production: secure cookies, a required JWT_SECRET and plain
 * JSON logs. The app is built once per function instance and serves every
 * request that instance receives, so the database pool is reused between them.
 *
 * Requests go through the database's connection pooler when the host provides
 * one: Prisma Postgres on Vercel sets DATABASE_URL_POOLED beside the direct
 * DATABASE_URL, which migrations keep using (see prisma.config.ts).
 */
const env = loadEnv({
  ...process.env,
  NODE_ENV: 'production',
  DATABASE_URL: process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL,
});
const app = await buildApp(env);
await app.ready();

export default function handler(request: IncomingMessage, response: ServerResponse) {
  app.server.emit('request', request, response);
}
