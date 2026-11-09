import {
  API_PREFIX,
  IMPORT_ERROR_CODES,
  importDetailSchema,
  importListResponseSchema,
  type ColumnMapping,
  type ImportDetail,
  type ImportSource,
} from '@montra/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ApiError, apiUrl } from './client';
import { authorizedRequest } from './session';
import { transactionKeys } from './transactions';

/*
 * The import workflow, from /businesses/:businessId/imports: upload → map
 * columns → review the preview → confirm (or cancel). Nothing becomes a
 * transaction until the owner confirms.
 */

const importsPath = (businessId: string) =>
  `${API_PREFIX}/businesses/${encodeURIComponent(businessId)}/imports`;

const importPath = (businessId: string, importId: string) =>
  `${importsPath(businessId)}/${encodeURIComponent(importId)}`;

export const importKeys = {
  all: (businessId: string) => ['imports', businessId] as const,
  list: (businessId: string) => ['imports', businessId, 'list'] as const,
  detail: (businessId: string, importId: string) => ['imports', businessId, importId] as const,
};

/** The official Montra template, header row only. Public: it holds no data. */
export const templateUrl = (format: 'csv' | 'xlsx') =>
  apiUrl(`${API_PREFIX}/imports/template?format=${format}`);

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Browsers label CSV files inconsistently (Windows often says Excel), so the name decides. */
export function contentTypeFor(fileName: string): string {
  return fileName.toLowerCase().endsWith('.xlsx') ? XLSX_TYPE : 'text/csv';
}

export function useImportList(businessId: string) {
  return useQuery({
    queryKey: importKeys.list(businessId),
    queryFn: ({ signal }) =>
      authorizedRequest(importsPath(businessId), { schema: importListResponseSchema, signal }),
  });
}

/** An import with its mapping and, while unconfirmed, a preview recomputed by the API. */
export function useImportDetail(businessId: string, importId: string | null) {
  return useQuery({
    queryKey: importKeys.detail(businessId, importId ?? ''),
    queryFn: ({ signal }) =>
      authorizedRequest(importPath(businessId, importId!), { schema: importDetailSchema, signal }),
    enabled: importId !== null,
  });
}

/** Stores what the API returned for an import, and refreshes the history list. */
function storeDetail(queryClient: QueryClient, businessId: string, detail: ImportDetail) {
  queryClient.setQueryData(importKeys.detail(businessId, detail.batch.id), detail);
  void queryClient.invalidateQueries({ queryKey: importKeys.list(businessId), exact: true });
}

/**
 * After a 409 the import has changed under the caller (confirmed in another
 * tab, cancelled, or expired): reload it so the sheet shows what it is now.
 */
function refreshIfStale(queryClient: QueryClient, businessId: string, err: unknown) {
  if (err instanceof ApiError && err.code === IMPORT_ERROR_CODES.NOT_PENDING) {
    void queryClient.invalidateQueries({ queryKey: importKeys.all(businessId) });
  }
}

export function useUploadImport(businessId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, source }: { file: File; source: ImportSource }) => {
      const query = new URLSearchParams({ source, fileName: file.name });
      return authorizedRequest(`${importsPath(businessId)}?${query}`, {
        method: 'POST',
        body: file,
        headers: { 'Content-Type': contentTypeFor(file.name) },
        schema: importDetailSchema,
      });
    },
    onSuccess: (detail) => storeDetail(queryClient, businessId, detail),
  });
}

export function useUpdateImportMapping(businessId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ importId, mapping }: { importId: string; mapping: ColumnMapping }) =>
      authorizedRequest(`${importPath(businessId, importId)}/mapping`, {
        method: 'PUT',
        body: { mapping },
        schema: importDetailSchema,
      }),
    onSuccess: (detail) => storeDetail(queryClient, businessId, detail),
    onError: (err) => refreshIfStale(queryClient, businessId, err),
  });
}

export function useConfirmImport(businessId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      importId,
      includePossibleDuplicates,
    }: {
      importId: string;
      includePossibleDuplicates: number[];
    }) =>
      authorizedRequest(`${importPath(businessId, importId)}/confirm`, {
        method: 'POST',
        body: { includePossibleDuplicates },
        schema: importDetailSchema,
      }),
    onSuccess: (detail) => {
      storeDetail(queryClient, businessId, detail);
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all(businessId) });
    },
    onError: (err) => refreshIfStale(queryClient, businessId, err),
  });
}

export function useCancelImport(businessId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (importId: string) =>
      authorizedRequest(importPath(businessId, importId), {
        method: 'DELETE',
        schema: importDetailSchema,
      }),
    onSuccess: (detail) => storeDetail(queryClient, businessId, detail),
    onError: (err) => refreshIfStale(queryClient, businessId, err),
  });
}
