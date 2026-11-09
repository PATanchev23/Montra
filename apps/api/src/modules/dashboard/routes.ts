import { apiErrorSchema, dashboardQuerySchema, dashboardResponseSchema } from '@montra/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authOf } from '../../plugins/auth';
import { requireMembership } from '../businesses/access';
import { getDashboard } from './service';

const businessParamsSchema = z.object({ businessId: z.string().min(1).max(64) });

/**
 * /businesses/:businessId/dashboard. Any member (OWNER or VIEWER) may read
 * it; everyone else gets a 404, whether or not the business exists.
 */
export const dashboardRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', app.authenticate);

  app.get(
    '/',
    {
      schema: {
        tags: ['dashboard'],
        summary: 'Income, expenses, trend, expense breakdown and recent transactions for a period',
        description:
          'Periods are calendar dates in the business’s time zone, inclusive, and are compared with the equivalent period before. Amounts are integer cents in the business currency.',
        security: [{ bearerAuth: [] }],
        params: businessParamsSchema,
        querystring: dashboardQuerySchema,
        response: {
          200: dashboardResponseSchema,
          400: apiErrorSchema,
          401: apiErrorSchema,
          404: apiErrorSchema,
        },
      },
    },
    async (request) => {
      const { businessId } = request.params;
      await requireMembership(app.db, authOf(request).userId, businessId);
      return getDashboard(app.db, businessId, request.query);
    },
  );
};
