import { buildApp, type AppDependencies } from '../src/app';
import { loadEnv } from '../src/config/env';

export async function createTestApp(
  overrides: NodeJS.ProcessEnv = {},
  dependencies: AppDependencies = {},
) {
  const app = await buildApp(loadEnv({ ...process.env, ...overrides }), dependencies);
  await app.ready();
  return app;
}
