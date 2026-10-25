import fp from 'fastify-plugin';
import { createDb, type Db } from '../db';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
  }
}

export interface PrismaPluginOptions {
  databaseUrl: string;
}

/** Exposes a single Prisma client as `app.db` and closes it with the server. */
export const prismaPlugin = fp<PrismaPluginOptions>(
  async (app, { databaseUrl }) => {
    const db = createDb(databaseUrl);
    app.decorate('db', db);
    app.addHook('onClose', async () => {
      await db.$disconnect();
    });
  },
  { name: 'prisma' },
);
