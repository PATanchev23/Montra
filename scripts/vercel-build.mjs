// Vercel's build step (see vercel.json). A production deployment first brings the
// database up to date with the committed migrations, then the API bundle (which
// api/index.js serves) and the web app are built. Preview deployments skip the
// migrations, so a branch can never change the production database.
import { execSync } from 'node:child_process';

const run = (command) => execSync(command, { stdio: 'inherit' });

/** The host a connection string points at; never the password. */
const host = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return 'not set';
  }
};

if (process.env.VERCEL_ENV === 'production') {
  // The same choice as apps/api/prisma.config.ts: direct, not through the pooler.
  const direct = process.env.DIRECT_URL || process.env.DATABASE_URL;
  console.log(`Migrating the database at ${host(direct)}.`);
  run('npm run db:deploy -w @montra/api');
} else {
  console.log('Not a production deployment: database migrations skipped.');
}
run('npm run build');
