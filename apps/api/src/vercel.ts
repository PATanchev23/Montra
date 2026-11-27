import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildApp } from './app';
import { loadEnv } from './config/env';

/*
 * The API as one Vercel Function (api/index.js re-exports this bundle). Vercel
 * always runs it as production: secure cookies, a required JWT_SECRET and plain
 * JSON logs. The app is built once per function instance and serves every
 * request that instance receives, so the database pool is reused between them.
 */
const env = loadEnv({ ...process.env, NODE_ENV: 'production' });
const app = await buildApp(env);
await app.ready();

export default function handler(request: IncomingMessage, response: ServerResponse) {
  app.server.emit('request', request, response);
}
