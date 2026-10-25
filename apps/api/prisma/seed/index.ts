// Seeds deterministic TechStore demo data. Safe to run repeatedly.
//
// Demo account credentials come only from the environment (see
// apps/api/.env.example). Accounts that are not configured are skipped.
import { loadEnv } from '../../src/config/env';
import { createDb } from '../../src/db';
import { loadSeedConfig } from './config';
import { seedDatabase } from './techstore';

async function main() {
  const env = loadEnv();
  const config = loadSeedConfig();
  const db = createDb(env.DATABASE_URL);
  try {
    const summary = await seedDatabase(db, config);
    console.log(`Seeded business "TechStore" (${summary.businessId})`);
    for (const account of summary.accounts) {
      console.log(
        `  ${account.role.padEnd(6)} ${account.email}${account.passwordChanged ? ' (password set)' : ''}`,
      );
    }
    if (!config.owner)
      console.log('  OWNER demo account skipped: DEMO_OWNER_EMAIL/PASSWORD not set');
    if (!config.viewer)
      console.log('  VIEWER demo account skipped: DEMO_VIEWER_EMAIL/PASSWORD not set');
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
