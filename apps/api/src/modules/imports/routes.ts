import {
  apiErrorSchema,
  confirmImportRequestSchema,
  IMPORT_ERROR_CODES,
  IMPORT_MAX_FILE_BYTES,
  importDetailSchema,
  importListResponseSchema,
  MONTRA_TEMPLATE_COLUMNS,
  updateImportMappingRequestSchema,
  uploadImportQuerySchema,
} from '@montra/shared';
import type { FastifyError } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AppError } from '../../lib/app-error';
import { authOf } from '../../plugins/auth';
import { ownerOnly as ownerOnlyHook, requireMembership } from '../businesses/access';
import {
  cancelImport,
  confirmImport,
  getImport,
  listImports,
  updateMapping,
  uploadImport,
} from './service';
import { writeXlsx } from './xlsx';

const id = z.string().min(1).max(64);
const businessParamsSchema = z.object({ businessId: id });
const importParamsSchema = z.object({ businessId: id, importId: id });

const MAX_MEGABYTES = IMPORT_MAX_FILE_BYTES / 1024 / 1024;

/**
 * /businesses/:businessId/imports. Members may look at imports; only an
 * OWNER may upload, map, confirm or cancel.
 */
export const importRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', app.authenticate);

  // An upload is the file itself as the request body, whatever its declared
  // type. text/plain is included, as its default parser would decode the
  // bytes as UTF-8 and damage Windows-1252 files.
  app.removeContentTypeParser(['text/plain']);
  app.addContentTypeParser(
    '*',
    { parseAs: 'buffer', bodyLimit: IMPORT_MAX_FILE_BYTES },
    (_request, body, done) => done(null, body),
  );
  app.setErrorHandler((error: FastifyError) => {
    // Rethrown errors reach the app's error handler, which formats them.
    if (error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      throw new AppError(
        413,
        IMPORT_ERROR_CODES.FILE_TOO_LARGE,
        `The file is larger than ${MAX_MEGABYTES} MB.`,
      );
    }
    throw error;
  });

  const tags = ['imports'];
  const security = [{ bearerAuth: [] }];
  const errors = { 401: apiErrorSchema, 404: apiErrorSchema };
  const writeErrors = { ...errors, 400: apiErrorSchema, 403: apiErrorSchema, 409: apiErrorSchema };

  const ownerOnly = ownerOnlyHook(app.db);

  app.post(
    '/',
    {
      onRequest: ownerOnly,
      bodyLimit: IMPORT_MAX_FILE_BYTES,
      schema: {
        tags,
        summary: 'Upload a CSV or XLSX file for preview (OWNER)',
        description: `The request body is the file itself (at most ${MAX_MEGABYTES} MB), not a form. Nothing is imported until the import is confirmed.`,
        security,
        params: businessParamsSchema,
        querystring: uploadImportQuerySchema,
        response: {
          201: importDetailSchema,
          ...writeErrors,
          413: apiErrorSchema,
          415: apiErrorSchema,
          422: apiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const contentType = request.headers['content-type'] ?? '';
      const body: unknown = request.body;
      // No body at all is an empty file; a parsed form or JSON object is the wrong kind of request.
      if (contentType.startsWith('multipart/') || (body != null && !Buffer.isBuffer(body))) {
        throw new AppError(
          415,
          IMPORT_ERROR_CODES.UNSUPPORTED_FILE,
          'Send the file itself as the request body, not as a form or JSON.',
        );
      }
      const detail = await uploadImport(app.db, {
        businessId: request.params.businessId,
        userId: authOf(request).userId,
        source: request.query.source,
        fileName: request.query.fileName,
        file: Buffer.isBuffer(body) ? body : Buffer.alloc(0),
      });
      reply.status(201);
      return detail;
    },
  );

  app.get(
    '/',
    {
      schema: {
        tags,
        summary: 'Recent imports, newest first',
        security,
        params: businessParamsSchema,
        response: { 200: importListResponseSchema, ...errors },
      },
    },
    async (request) => {
      const { businessId } = request.params;
      await requireMembership(app.db, authOf(request).userId, businessId);
      return listImports(app.db, businessId);
    },
  );

  app.get(
    '/:importId',
    {
      schema: {
        tags,
        summary: 'An import, with its mapping and a fresh preview while unconfirmed',
        security,
        params: importParamsSchema,
        response: { 200: importDetailSchema, ...errors },
      },
    },
    async (request) => {
      const { businessId, importId } = request.params;
      await requireMembership(app.db, authOf(request).userId, businessId);
      return getImport(app.db, businessId, importId);
    },
  );

  app.put(
    '/:importId/mapping',
    {
      onRequest: ownerOnly,
      schema: {
        tags,
        summary: 'Map a template or generic file’s columns to transaction fields (OWNER)',
        security,
        params: importParamsSchema,
        body: updateImportMappingRequestSchema,
        response: { 200: importDetailSchema, ...writeErrors },
      },
    },
    async (request) => {
      const { businessId, importId } = request.params;
      return updateMapping(app.db, businessId, importId, request.body.mapping);
    },
  );

  app.post(
    '/:importId/confirm',
    {
      onRequest: ownerOnly,
      schema: {
        tags,
        summary: 'Import the previewed records (OWNER)',
        description:
          'Saves every valid record, plus the possible duplicates listed, in one database transaction. Duplicates by external id are never imported.',
        security,
        params: importParamsSchema,
        body: confirmImportRequestSchema.nullish(),
        response: { 200: importDetailSchema, ...writeErrors },
      },
    },
    async (request) => {
      const { businessId, importId } = request.params;
      return confirmImport(
        app.db,
        businessId,
        importId,
        request.body?.includePossibleDuplicates ?? [],
      );
    },
  );

  app.delete(
    '/:importId',
    {
      onRequest: ownerOnly,
      schema: {
        tags,
        summary: 'Cancel an unconfirmed import and discard its data (OWNER)',
        security,
        params: importParamsSchema,
        response: { 200: importDetailSchema, ...writeErrors },
      },
    },
    async (request) => {
      const { businessId, importId } = request.params;
      return cancelImport(app.db, businessId, importId);
    },
  );
};

/** The official template, header row only. Public: it holds no data. */
export const importTemplateRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/template',
    {
      schema: {
        tags: ['imports'],
        summary: 'Download the Montra import template',
        querystring: z.object({ format: z.enum(['csv', 'xlsx']).default('xlsx') }),
      },
    },
    async (request, reply) => {
      const headers = MONTRA_TEMPLATE_COLUMNS.map((column) => column.header);
      const { format } = request.query;
      reply.header('Content-Disposition', `attachment; filename="montra-template.${format}"`);
      if (format === 'csv') {
        // The BOM makes Excel read the file as UTF-8.
        reply.type('text/csv; charset=utf-8');
        return `\ufeff${headers.join(',')}\r\n`;
      }
      reply.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return writeXlsx([headers]);
    },
  );
};
