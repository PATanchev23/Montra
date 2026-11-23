import {
  apiErrorSchema,
  billingRedirectSchema,
  billingResponseSchema,
  checkoutRequestSchema,
} from '@montra/shared';
import type { FastifyPluginAsyncZod, ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authOf } from '../../plugins/auth';
import {
  getBilling,
  handleWebhook,
  openPortal,
  startCheckout,
  type BillingConfig,
} from './service';

export interface BillingRoutesOptions {
  billing: BillingConfig;
}

const security = [{ bearerAuth: [] }];

export const billingRoutes: FastifyPluginAsyncZod<BillingRoutesOptions> = async (
  app,
  { billing },
) => {
  // The signed-in account's plan, and the ways to change it.
  await app.register(async (scope) => {
    const account = scope.withTypeProvider<ZodTypeProvider>();
    account.addHook('onRequest', account.authenticate);

    account.get(
      '/',
      {
        schema: {
          tags: ['billing'],
          summary: "The signed-in account's plan and subscription",
          security,
          response: { 200: billingResponseSchema, 401: apiErrorSchema },
        },
      },
      async (request) => getBilling(app.db, billing, authOf(request).userId),
    );

    account.post(
      '/checkout',
      {
        schema: {
          tags: ['billing'],
          summary: 'Start a Stripe Checkout for a paid plan',
          security,
          body: checkoutRequestSchema,
          response: {
            200: billingRedirectSchema,
            401: apiErrorSchema,
            403: apiErrorSchema,
            409: apiErrorSchema,
            502: apiErrorSchema,
            503: apiErrorSchema,
          },
        },
      },
      async (request) =>
        startCheckout(app.db, billing, request.log, authOf(request).userId, request.body.plan),
    );

    account.post(
      '/portal',
      {
        schema: {
          tags: ['billing'],
          summary: "Open Stripe's billing portal to change card, switch plan or cancel",
          security,
          response: {
            200: billingRedirectSchema,
            401: apiErrorSchema,
            409: apiErrorSchema,
            502: apiErrorSchema,
            503: apiErrorSchema,
          },
        },
      },
      async (request) => openPortal(app.db, billing, request.log, authOf(request).userId),
    );
  });

  // Events from Stripe. Signature checks need the body exactly as sent, so in
  // this scope JSON arrives as a string instead of being parsed.
  await app.register(async (scope) => {
    const webhook = scope.withTypeProvider<ZodTypeProvider>();
    webhook.removeContentTypeParser('application/json');
    webhook.addContentTypeParser(
      'application/json',
      { parseAs: 'string' },
      (_request, body, done) => done(null, body),
    );

    webhook.post(
      '/webhook',
      {
        schema: {
          tags: ['billing'],
          summary: 'Stripe webhook (signed by Stripe)',
          response: {
            200: z.object({ received: z.literal(true) }),
            400: apiErrorSchema,
            503: apiErrorSchema,
          },
        },
      },
      async (request) => {
        const signature = request.headers['stripe-signature'];
        await handleWebhook(
          app.db,
          billing,
          request.log,
          typeof request.body === 'string' ? request.body : '',
          typeof signature === 'string' ? signature : undefined,
        );
        return { received: true as const };
      },
    );
  });
};
