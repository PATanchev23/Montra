import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Prisma 7 no longer reads .env on its own.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed/index.ts',
  },
  datasource: {
    // Migrations and the seed want a direct connection. A host that serves the app
    // through a connection pooler (Prisma Postgres on Vercel) sets DIRECT_URL for them.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
});
