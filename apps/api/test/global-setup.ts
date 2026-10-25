import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** Brings the test database schema up to date before any integration test runs. */
export default function setup() {
  execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
    env: {
      ...process.env,
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        'postgresql://postgres:postgres@localhost:5432/montra_test',
    },
    stdio: 'pipe',
  });
}
