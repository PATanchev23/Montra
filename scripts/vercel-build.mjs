// Vercel's build step (see vercel.json). A production deployment first brings the
// database up to date with the committed migrations, then the API bundle (which
// api/index.js serves) and the web app are built. Preview deployments skip the
// migrations, so a branch can never change the production database.
import { execSync } from 'node:child_process';

const run = (command) => execSync(command, { stdio: 'inherit' });

if (process.env.VERCEL_ENV === 'production') {
  run('npm run db:deploy -w @montra/api');
} else {
  console.log('Not a production deployment: database migrations skipped.');
}
run('npm run build');
