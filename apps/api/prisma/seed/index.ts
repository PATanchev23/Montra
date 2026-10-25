// Seeds deterministic TechStore demo data. Safe to run repeatedly: every
// record is upserted by a stable natural key.
//
// Goal 1 seeds only the business itself; transactions, suppliers and budgets
// are generated here in later goals.
import { createDb } from '../../src/db';
import { loadEnv } from '../../src/config/env';

const TECHSTORE = {
  slug: 'techstore',
  name: 'TechStore',
  currency: 'EUR',
  timezone: 'Europe/Sofia',
} as const;

async function main() {
  const env = loadEnv();
  const db = createDb(env.DATABASE_URL);
  try {
    const business = await db.business.upsert({
      where: { slug: TECHSTORE.slug },
      update: { name: TECHSTORE.name, currency: TECHSTORE.currency, timezone: TECHSTORE.timezone },
      create: TECHSTORE,
    });
    console.log(`Seeded business "${business.name}" (${business.id})`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
