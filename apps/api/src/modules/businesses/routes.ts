import {
  apiErrorSchema,
  businessResponseSchema,
  currencySchema,
  type BusinessResponse,
} from '@montra/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authOf } from '../../plugins/auth';
import { requireMembership } from './access';

const businessParamsSchema = z.object({ businessId: z.string().min(1).max(64) });

export const businessRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', app.authenticate);

  app.get(
    '/:businessId',
    {
      schema: {
        tags: ['businesses'],
        summary: 'A business the caller belongs to, with their role in it',
        security: [{ bearerAuth: [] }],
        params: businessParamsSchema,
        response: { 200: businessResponseSchema, 401: apiErrorSchema, 404: apiErrorSchema },
      },
    },
    async (request): Promise<BusinessResponse> => {
      const { businessId } = request.params;
      const role = await requireMembership(app.db, authOf(request).userId, businessId);
      const business = await app.db.business.findUniqueOrThrow({
        where: { id: businessId },
        select: {
          id: true,
          slug: true,
          name: true,
          currency: true,
          timezone: true,
          industry: true,
          fiscalYearStartMonth: true,
          lowBalanceThresholdCents: true,
        },
      });
      return { role, business: { ...business, currency: currencySchema.parse(business.currency) } };
    },
  );
};
