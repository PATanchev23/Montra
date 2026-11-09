import {
  columnMappingSchema,
  confirmImportRequestSchema,
  createTransactionRequestSchema,
  transactionListQuerySchema,
  updateTransactionRequestSchema,
  type ColumnMapping,
  type CurrentUserResponse,
  type ImportDetail,
  type ImportSource,
  type MembershipRole,
  type Transaction,
} from '@montra/shared';
import { vi } from 'vitest';
import { apiError, authBody, jsonResponse, profile } from './authApi';

/*
 * A stand-in for the transactions and imports API, for page tests. It keeps
 * state between requests as the database would, validates requests with the
 * shared schemas, and refuses writes from viewers as the real API does.
 */

export const BUSINESS_ID = 'biz-1';
const BASE = `/api/v1/businesses/${BUSINESS_ID}`;

export function transaction(overrides: Partial<Transaction> & { id: string }): Transaction {
  return {
    type: 'EXPENSE',
    amountCents: 1000,
    description: 'Payment',
    category: 'Other',
    date: '2026-10-01',
    importSource: null,
    importBatchId: null,
    externalId: null,
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-01T08:00:00.000Z',
    ...overrides,
  };
}

export interface LedgerOptions {
  role?: MembershipRole;
  currency?: CurrentUserResponse['memberships'][number]['business']['currency'];
  transactions?: Transaction[];
  imports?: ImportDetail[];
  /** The detail a new upload produces; or a Response to send instead (an error). */
  onUpload?: (file: File, source: ImportSource, fileName: string) => ImportDetail | Response;
  /** The detail after the mapping changes. */
  onMapping?: (detail: ImportDetail, mapping: ColumnMapping) => ImportDetail;
}

type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;

const forbidden = () => apiError(403, 'FORBIDDEN', 'Only the business owner can make changes.');

export function ledgerServer(options: LedgerOptions = {}) {
  const role = options.role ?? 'OWNER';
  const currency = options.currency ?? 'EUR';
  const state = {
    transactions: [...(options.transactions ?? [])],
    imports: new Map((options.imports ?? []).map((detail) => [detail.batch.id, detail])),
    /** Set to make every write fail as if the role had changed on the server. */
    refuseWrites: false,
    /** Answers a request instead of the fake when it returns a response. */
    override: null as ((method: string, url: URL) => Response | undefined) | null,
  };
  let nextId = 1;

  const me = profile({
    memberships: [
      {
        role,
        business: {
          id: BUSINESS_ID,
          slug: 'techstore',
          name: 'TechStore',
          currency,
          timezone: 'Europe/Sofia',
        },
      },
    ],
  });

  const canWrite = () => role === 'OWNER' && !state.refuseWrites;
  const bodyOf = (init: RequestInit) => JSON.parse((init.body as string | undefined) ?? 'null');

  function list(url: URL) {
    const query = transactionListQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!query.success) return apiError(400, 'VALIDATION_ERROR', 'The request is invalid.');
    const { page, pageSize, type, category, from, to, sort } = query.data;
    const items = state.transactions
      .filter(
        (t) =>
          (!type || t.type === type) &&
          (!category || t.category.toLowerCase() === category.toLowerCase()) &&
          (!from || t.date >= from) &&
          (!to || t.date <= to),
      )
      .sort((a, b) => {
        const [key, direction] = sort.split('_') as ['date' | 'amount', 'asc' | 'desc'];
        const diff = key === 'date' ? a.date.localeCompare(b.date) : a.amountCents - b.amountCents;
        return (direction === 'asc' ? diff : -diff) || a.id.localeCompare(b.id);
      });
    return jsonResponse({
      items: items.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      total: items.length,
      pageCount: Math.ceil(items.length / pageSize),
    });
  }

  function categories() {
    const byName = new Map<string, { name: string; incomeCount: number; expenseCount: number }>();
    for (const t of state.transactions) {
      const entry = byName.get(t.category.toLowerCase()) ?? {
        name: t.category,
        incomeCount: 0,
        expenseCount: 0,
      };
      if (t.type === 'INCOME') entry.incomeCount++;
      else entry.expenseCount++;
      byName.set(t.category.toLowerCase(), entry);
    }
    return jsonResponse({
      items: [...byName.values()].sort((a, b) => a.name.localeCompare(b.name)),
    });
  }

  function confirmImport(detail: ImportDetail, include: number[]): ImportDetail {
    const entries = detail.preview?.entries ?? [];
    const chosen = entries.filter(
      (e) =>
        e.status === 'VALID' || (e.status === 'POSSIBLE_DUPLICATE' && include.includes(e.index)),
    );
    for (const entry of chosen) {
      state.transactions.push(
        transaction({
          id: `imported-${nextId++}`,
          ...entry.transaction!,
          importSource: detail.batch.source,
          importBatchId: detail.batch.id,
        }),
      );
    }
    const failed = entries.filter((e) => e.status === 'INVALID').length;
    return {
      ...detail,
      batch: {
        ...detail.batch,
        status: chosen.length > 0 || failed === 0 ? 'COMPLETED' : 'FAILED',
        totalRecords: entries.length,
        importedRecords: chosen.length,
        failedRecords: failed,
        skippedRecords: entries.length - chosen.length - failed,
        completedAt: '2026-11-09T10:00:00.000Z',
        expiresAt: null,
      },
      columns: [],
      sampleRows: [],
      missing: [],
      preview: null,
      notices: [],
    };
  }

  const routes: [string, RegExp, Handler][] = [
    ['POST', /^\/api\/v1\/auth\/refresh$/, () => jsonResponse(authBody(me))],
    ['GET', /^\/api\/v1\/auth\/me$/, () => jsonResponse(me)],
    ['GET', new RegExp(`^${BASE}/transactions$`), (url) => list(url)],
    ['GET', new RegExp(`^${BASE}/transactions/categories$`), () => categories()],
    [
      'POST',
      new RegExp(`^${BASE}/transactions$`),
      (_url, init) => {
        if (!canWrite()) return forbidden();
        const body = createTransactionRequestSchema.safeParse(bodyOf(init));
        if (!body.success) return apiError(400, 'VALIDATION_ERROR', 'The request is invalid.');
        if (body.data.currency && body.data.currency !== currency) {
          return apiError(
            422,
            'CURRENCY_MISMATCH',
            `This business records amounts in ${currency}.`,
          );
        }
        const { currency: _currency, ...fields } = body.data;
        const created = transaction({ id: `new-${nextId++}`, ...fields });
        state.transactions.push(created);
        return jsonResponse(created, 201);
      },
    ],
    [
      'PATCH',
      new RegExp(`^${BASE}/transactions/([^/]+)$`),
      (url, init) => {
        if (!canWrite()) return forbidden();
        const id = decodeURIComponent(url.pathname.split('/').pop()!);
        const index = state.transactions.findIndex((t) => t.id === id);
        if (index < 0) return apiError(404, 'NOT_FOUND', 'Transaction not found.');
        const body = updateTransactionRequestSchema.safeParse(bodyOf(init));
        if (!body.success) return apiError(400, 'VALIDATION_ERROR', 'The request is invalid.');
        const { currency: _currency, ...fields } = body.data;
        const updated = {
          ...state.transactions[index]!,
          ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)),
          updatedAt: '2026-11-09T10:00:00.000Z',
        };
        state.transactions[index] = updated;
        return jsonResponse(updated);
      },
    ],
    [
      'DELETE',
      new RegExp(`^${BASE}/transactions/([^/]+)$`),
      (url) => {
        if (!canWrite()) return forbidden();
        const id = decodeURIComponent(url.pathname.split('/').pop()!);
        const before = state.transactions.length;
        state.transactions = state.transactions.filter((t) => t.id !== id);
        if (state.transactions.length === before) {
          return apiError(404, 'NOT_FOUND', 'Transaction not found.');
        }
        return new Response(null, { status: 204 });
      },
    ],
    [
      'GET',
      new RegExp(`^${BASE}/imports$`),
      () =>
        jsonResponse({
          items: [...state.imports.values()]
            .map((detail) => detail.batch)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        }),
    ],
    [
      'POST',
      new RegExp(`^${BASE}/imports$`),
      (url, init) => {
        if (!canWrite()) return forbidden();
        const file = init.body as File;
        const source = url.searchParams.get('source') as ImportSource;
        const fileName = url.searchParams.get('fileName')!;
        const result = options.onUpload?.(file, source, fileName);
        if (!result) throw new Error('No onUpload handler for this test');
        if (result instanceof Response) return result;
        state.imports.set(result.batch.id, result);
        return jsonResponse(result, 201);
      },
    ],
    [
      'GET',
      new RegExp(`^${BASE}/imports/([^/]+)$`),
      (url) => {
        const detail = state.imports.get(decodeURIComponent(url.pathname.split('/').pop()!));
        return detail ? jsonResponse(detail) : apiError(404, 'NOT_FOUND', 'Import not found.');
      },
    ],
    [
      'PUT',
      new RegExp(`^${BASE}/imports/([^/]+)/mapping$`),
      (url, init) => {
        if (!canWrite()) return forbidden();
        const id = url.pathname.split('/').at(-2)!;
        const detail = state.imports.get(id)!;
        const { mapping } = bodyOf(init);
        if (!columnMappingSchema.safeParse(mapping).success) {
          return apiError(400, 'VALIDATION_ERROR', 'The request is invalid.');
        }
        const next = options.onMapping!(detail, mapping);
        state.imports.set(id, next);
        return jsonResponse(next);
      },
    ],
    [
      'POST',
      new RegExp(`^${BASE}/imports/([^/]+)/confirm$`),
      (url, init) => {
        if (!canWrite()) return forbidden();
        const id = url.pathname.split('/').at(-2)!;
        const detail = state.imports.get(id)!;
        if (detail.batch.status !== 'READY') {
          return apiError(409, 'IMPORT_NOT_PENDING', 'This import can no longer change.');
        }
        const body = confirmImportRequestSchema.parse(bodyOf(init) ?? {});
        const next = confirmImport(detail, body.includePossibleDuplicates);
        state.imports.set(id, next);
        return jsonResponse(next);
      },
    ],
    [
      'DELETE',
      new RegExp(`^${BASE}/imports/([^/]+)$`),
      (url) => {
        if (!canWrite()) return forbidden();
        const id = url.pathname.split('/').pop()!;
        const detail = state.imports.get(id)!;
        const next: ImportDetail = {
          ...detail,
          batch: { ...detail.batch, status: 'CANCELLED', expiresAt: null },
          columns: [],
          sampleRows: [],
          preview: null,
          missing: [],
          notices: [],
        };
        state.imports.set(id, next);
        return jsonResponse(next);
      },
    ],
  ];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), 'http://montra.test');
    const method = init.method ?? 'GET';
    const overridden = state.override?.(method, url);
    if (overridden) return overridden;
    const route = routes.find(([m, pattern]) => m === method && pattern.test(url.pathname));
    if (!route) throw new Error(`Unexpected request: ${method} ${url.pathname}${url.search}`);
    return route[2](url, init);
  });
  vi.stubGlobal('fetch', fetchMock);

  return {
    state,
    fetchMock,
    /** Requests made, as "METHOD /path?query". */
    requests: () =>
      fetchMock.mock.calls.map(([input, init]) => `${init?.method ?? 'GET'} ${String(input)}`),
    /** The query of every list request, in order. */
    listQueries: () =>
      fetchMock.mock.calls
        .map(([input, init]) => ({ url: new URL(String(input), 'http://montra.test'), init }))
        .filter(
          ({ url, init }) =>
            (init?.method ?? 'GET') === 'GET' && url.pathname === `${BASE}/transactions`,
        )
        .map(({ url }) => Object.fromEntries(url.searchParams)),
    /** Parsed JSON bodies of requests matching method and path suffix. */
    bodies: (method: string, suffix: RegExp) =>
      fetchMock.mock.calls
        .filter(
          ([input, init]) =>
            (init?.method ?? 'GET') === method &&
            suffix.test(new URL(String(input), 'http://montra.test').pathname),
        )
        .map(([, init]) => bodyOf(init!)),
  };
}
