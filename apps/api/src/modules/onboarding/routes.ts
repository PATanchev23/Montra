import {
  apiErrorSchema,
  completeOnboardingResponseSchema,
  onboardingProgressSchema,
  saveOnboardingRequestSchema,
} from '@montra/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { authOf } from '../../plugins/auth';
import { completeOnboarding, getProgress, saveProgress } from './service';

/**
 * The signed-in user's own onboarding. No route takes a user or business id,
 * so nobody can read or change another user's progress.
 */
export const onboardingRoutes: FastifyPluginAsyncZod = async (app) => {
  // onRequest, so an unauthenticated request is refused before its body is read.
  app.addHook('onRequest', app.authenticate);

  const security = [{ bearerAuth: [] }];

  app.get(
    '/',
    {
      schema: {
        tags: ['onboarding'],
        summary: 'Onboarding progress and the saved draft, to resume where the user left off',
        security,
        response: { 200: onboardingProgressSchema, 401: apiErrorSchema },
      },
    },
    async (request) => getProgress(app.db, authOf(request).userId),
  );

  app.put(
    '/',
    {
      schema: {
        tags: ['onboarding'],
        summary: 'Save the current step and answers so far',
        description:
          'Replaces the saved draft. Fields may be missing, but any field present must be valid. Refused once onboarding is complete.',
        security,
        body: saveOnboardingRequestSchema,
        response: {
          200: onboardingProgressSchema,
          400: apiErrorSchema,
          401: apiErrorSchema,
          409: apiErrorSchema,
        },
      },
    },
    async (request) => saveProgress(app.db, authOf(request).userId, request.body),
  );

  app.post(
    '/complete',
    {
      schema: {
        tags: ['onboarding'],
        summary: 'Create the business from the saved draft',
        description:
          'Validates the saved draft, then creates the business and the caller’s OWNER membership and marks onboarding complete, atomically. Succeeds once per user.',
        security,
        response: {
          201: completeOnboardingResponseSchema,
          401: apiErrorSchema,
          409: apiErrorSchema,
          422: apiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await completeOnboarding(app.db, authOf(request).userId);
      reply.status(201);
      return result;
    },
  );
};
