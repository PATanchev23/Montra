import {
  apiErrorSchema,
  businessResponseSchema,
  createBusinessRequestSchema,
  createBusinessResponseSchema,
  currencySchema,
  type BusinessResponse,
} from '@montra/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authOf } from '../../plugins/auth';
import { requireMembership } from './access';
import { createAdditionalBusiness } from './service';

const businessParamsSchema = z.object({ businessId: z.string().min(1).max(64) });

export const businessRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', app.authenticate);

  app.post(
    '/',
    {
      schema: {
        tags: ['businesses'],
        summary: 'Add another business to the account',
        description:
          'Creates a business from the same answers onboarding asks for, with the caller as its OWNER. For accounts that already own a business (the first comes from onboarding), up to their plan’s limit: Free 1, Pro 3, Business 5. Only owned businesses count, and a smaller plan never takes one away.',
        security: [{ bearerAuth: [] }],
        body: createBusinessRequestSchema,
        response: {
          201: createBusinessResponseSchema,
          400: apiErrorSchema,
          401: apiErrorSchema,
          403: apiErrorSchema,
          409: apiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await createAdditionalBusiness(app.db, authOf(request).userId, request.body);
      reply.status(201);
      return result;
    },
  );

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
