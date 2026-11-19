import {
  alertsResponseSchema,
  apiErrorSchema,
  budgetLimitsResponseSchema,
  budgetMonthResponseSchema,
  budgetQuerySchema,
  cashFlowResponseSchema,
  cashSettingsRequestSchema,
  cashSettingsSchema,
  reportQuerySchema,
  reportResponseSchema,
  scenarioPresetsResponseSchema,
  scenarioQuerySchema,
  simulationResponseSchema,
  updateBudgetsRequestSchema,
} from '@montra/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authOf } from '../../plugins/auth';
import { ownerOnly, requireMembership } from '../businesses/access';
import {
  getAlerts,
  getBudgets,
  getCashFlow,
  getReport,
  getScenarioPresets,
  replaceBudgets,
  runSimulation,
  updateCashSettings,
} from './service';

const businessParamsSchema = z.object({ businessId: z.string().min(1).max(64) });

const readErrors = { 400: apiErrorSchema, 401: apiErrorSchema, 404: apiErrorSchema };
const writeErrors = { ...readErrors, 403: apiErrorSchema };

/**
 * Everything under /businesses/:businessId that is computed from the ledger:
 * cash flow, budgets, simulations, reports and alerts. Any member may read;
 * only an OWNER may change the cash settings or the budgets.
 */
export const financeRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', app.authenticate);
  const owner = ownerOnly(app.db);
  const member = async (businessId: string, userId: string) =>
    requireMembership(app.db, userId, businessId);

  app.get(
    '/cash-flow',
    {
      schema: {
        tags: ['finance'],
        summary: 'Monthly cash flow, the balance with its 90-day projection, and upcoming payments',
        description:
          'Recurring payments are recognised from the ledger (a description paid once a month in at least three of the last six months); everything else is projected at its rate over the last 90 days. Balances start from the bank balance in the cash settings, or from zero without one.',
        security: [{ bearerAuth: [] }],
        params: businessParamsSchema,
        response: { 200: cashFlowResponseSchema, ...readErrors },
      },
    },
    async (request) => {
      await member(request.params.businessId, authOf(request).userId);
      return getCashFlow(app.db, request.params.businessId);
    },
  );

  app.put(
    '/cash-settings',
    {
      onRequest: owner,
      schema: {
        tags: ['finance'],
        summary: 'Set the bank balance today and the low-balance warning (OWNER)',
        security: [{ bearerAuth: [] }],
        params: businessParamsSchema,
        body: cashSettingsRequestSchema,
        response: { 200: cashSettingsSchema, ...writeErrors },
      },
    },
    async (request) => updateCashSettings(app.db, request.params.businessId, request.body),
  );

  app.get(
    '/budgets',
    {
      schema: {
        tags: ['finance'],
        summary: 'Spending against each monthly budget, for one month',
        security: [{ bearerAuth: [] }],
        params: businessParamsSchema,
        querystring: budgetQuerySchema,
        response: { 200: budgetMonthResponseSchema, ...readErrors },
      },
    },
    async (request) => {
      await member(request.params.businessId, authOf(request).userId);
      return getBudgets(app.db, request.params.businessId, request.query.month);
    },
  );

  app.put(
    '/budgets',
    {
      onRequest: owner,
      schema: {
        tags: ['finance'],
        summary: 'Replace every monthly budget (OWNER)',
        security: [{ bearerAuth: [] }],
        params: businessParamsSchema,
        body: updateBudgetsRequestSchema,
        response: { 200: budgetLimitsResponseSchema, ...writeErrors },
      },
    },
    async (request) => replaceBudgets(app.db, request.params.businessId, request.body),
  );

  app.get(
    '/simulations',
    {
      schema: {
        tags: ['finance'],
        summary: 'Ready-made what-if scenarios, sized to this business',
        security: [{ bearerAuth: [] }],
        params: businessParamsSchema,
        response: { 200: scenarioPresetsResponseSchema, ...readErrors },
      },
    },
    async (request) => {
      await member(request.params.businessId, authOf(request).userId);
      return getScenarioPresets(app.db, request.params.businessId);
    },
  );

  app.get(
    '/simulations/run',
    {
      schema: {
        tags: ['finance'],
        summary: 'The 90-day plan with and without a what-if',
        description:
          'Read-only: the rule is sent in the query string and nothing is saved, so viewers can run scenarios too.',
        security: [{ bearerAuth: [] }],
        params: businessParamsSchema,
        querystring: scenarioQuerySchema,
        response: { 200: simulationResponseSchema, ...readErrors },
      },
    },
    async (request) => {
      await member(request.params.businessId, authOf(request).userId);
      return runSimulation(app.db, request.params.businessId, request.query);
    },
  );

  app.get(
    '/reports',
    {
      schema: {
        tags: ['finance'],
        summary: 'Profit and loss by category and quarter, monthly totals and top income',
        security: [{ bearerAuth: [] }],
        params: businessParamsSchema,
        querystring: reportQuerySchema,
        response: { 200: reportResponseSchema, ...readErrors },
      },
    },
    async (request) => {
      await member(request.params.businessId, authOf(request).userId);
      return getReport(app.db, request.params.businessId, request.query.year);
    },
  );

  app.get(
    '/alerts',
    {
      schema: {
        tags: ['finance'],
        summary: 'Payments due within three days, overspent budgets and a projected low balance',
        security: [{ bearerAuth: [] }],
        params: businessParamsSchema,
        response: { 200: alertsResponseSchema, ...readErrors },
      },
    },
    async (request) => {
      await member(request.params.businessId, authOf(request).userId);
      return getAlerts(app.db, request.params.businessId);
    },
  );
};
