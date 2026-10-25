import { buildApp } from './app';
import { loadEnv } from './config/env';

const env = loadEnv();
const app = await buildApp(env);

const shutdown = async (signal: NodeJS.Signals) => {
  app.log.info({ signal }, 'Shutting down');
  await app.close();
  process.exit(0);
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
