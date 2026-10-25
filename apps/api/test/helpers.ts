import { buildApp } from '../src/app';
import { loadEnv } from '../src/config/env';

export async function createTestApp(overrides: NodeJS.ProcessEnv = {}) {
  const app = await buildApp(loadEnv({ ...process.env, ...overrides }));
  await app.ready();
  return app;
}
