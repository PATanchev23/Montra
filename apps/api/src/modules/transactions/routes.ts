import {
  apiErrorSchema,
  createTransactionRequestSchema,
  transactionCategoryListResponseSchema,
  transactionListQuerySchema,
  transactionListResponseSchema,
  transactionSchema,
  updateTransactionRequestSchema,
} from '@montra/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authOf } from '../../plugins/auth';
import { ownerOnly, requireMembership } from '../businesses/access';
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listCategories,
  listTransactions,
  updateTransaction,
} from './service';

const id = z.string().min(1).max(64);
const businessParamsSchema = z.object({ businessId: id });
const transactionParamsSchema = z.object({ businessId: id, transactionId: id });

/**
 * /businesses/:businessId/transactions. Members may read; only an OWNER may
 * create, change or delete. Non-members get a 404 for every route.
 */
export const transactionRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', app.authenticate);

  const tags = ['transactions'];
  const security = [{ bearerAuth: [] }];
  const errors = { 401: apiErrorSchema, 404: apiErrorSchema };
  const writeErrors = { ...errors, 400: apiErrorSchema, 403: apiErrorSchema };
  // Writes check the role before the body is read; reads check membership in the handler.
  const onRequest = ownerOnly(app.db);

  app.get(
    '/',
    {
      schema: {
        tags,
        summary: 'Transaction history, filtered, sorted and paginated',
        security,
        params: businessParamsSchema,
        querystring: transactionListQuerySchema,
        response: { 200: transactionListResponseSchema, 400: apiErrorSchema, ...errors },
      },
    },
    async (request) => {
      const { businessId } = request.params;
      await requireMembership(app.db, authOf(request).userId, businessId);
      return listTransactions(app.db, businessId, request.query);
    },
  );

  app.post(
    '/',
    {
      onRequest,
      schema: {
        tags,
        summary: 'Record income or an expense (OWNER)',
        security,
        params: businessParamsSchema,
        body: createTransactionRequestSchema,
        response: { 201: transactionSchema, 422: apiErrorSchema, ...writeErrors },
      },
    },
    async (request, reply) => {
      const { businessId } = request.params;
      const transaction = await createTransaction(app.db, businessId, request.body);
      reply.status(201);
      return transaction;
    },
  );

  app.get(
    '/categories',
    {
      schema: {
        tags,
        summary: 'Categories the business’s transactions use, for filters and suggestions',
        security,
        params: businessParamsSchema,
        response: { 200: transactionCategoryListResponseSchema, ...errors },
      },
    },
    async (request) => {
      const { businessId } = request.params;
      await requireMembership(app.db, authOf(request).userId, businessId);
      return listCategories(app.db, businessId);
    },
  );

  app.get(
    '/:transactionId',
    {
      schema: {
        tags,
        summary: 'One transaction',
        security,
        params: transactionParamsSchema,
        response: { 200: transactionSchema, ...errors },
      },
    },
    async (request) => {
      const { businessId, transactionId } = request.params;
      await requireMembership(app.db, authOf(request).userId, businessId);
      return getTransaction(app.db, businessId, transactionId);
    },
  );

  app.patch(
    '/:transactionId',
    {
      onRequest,
      schema: {
        tags,
        summary: 'Change a transaction (OWNER)',
        security,
        params: transactionParamsSchema,
        body: updateTransactionRequestSchema,
        response: { 200: transactionSchema, 422: apiErrorSchema, ...writeErrors },
      },
    },
    async (request) => {
      const { businessId, transactionId } = request.params;
      return updateTransaction(app.db, businessId, transactionId, request.body);
    },
  );

  app.delete(
    '/:transactionId',
    {
      onRequest,
      schema: {
        tags,
        summary: 'Delete a transaction (OWNER)',
        security,
        params: transactionParamsSchema,
        response: { 204: z.null(), ...writeErrors },
      },
    },
    async (request, reply) => {
      const { businessId, transactionId } = request.params;
      await deleteTransaction(app.db, businessId, transactionId);
      return reply.status(204).send(null);
    },
  );
};
