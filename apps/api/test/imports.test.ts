import {
  apiErrorSchema,
  authResponseSchema,
  importDetailSchema,
  importListResponseSchema,
  type ColumnMapping,
  type ImportSource,
} from '@montra/shared';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../src/app';
import { readXlsx, writeXlsx } from '../src/modules/imports/xlsx';
import { fixtures, useTestDb } from './db';
import { createTestApp } from './helpers';

const PASSWORD = 'correct horse battery';
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url));

type Response = Awaited<ReturnType<App['inject']>>;
const errorOf = (res: Response) => apiErrorSchema.parse(res.json()).error;
const detailOf = (res: Response) => importDetailSchema.parse(res.json());

describe('imports API', () => {
  const db = useTestDb();
  let app: App;
  let counter = 0;

  beforeAll(async () => {
    app = await createTestApp({ AUTH_RATE_LIMIT_MAX: '1000' });
  });
  afterAll(() => app.close());

  async function signUp() {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { name: 'User', email: `importer${++counter}@example.com`, password: PASSWORD },
    });
    const body = authResponseSchema.parse(res.json());
    return { userId: body.user.id, token: body.accessToken };
  }

  let business: { id: string };
  let other: { id: string };
  let owner: { token: string };
  let viewer: { token: string };
  let outsider: { token: string };

  beforeEach(async () => {
    business = await db.business.create({ data: fixtures.business({ name: 'Shop' }) });
    other = await db.business.create({ data: fixtures.business({ name: 'Other' }) });
    const [ownerAccount, viewerAccount, outsiderAccount] = [
      await signUp(),
      await signUp(),
      await signUp(),
    ] as const;
    [owner, viewer, outsider] = [ownerAccount, viewerAccount, outsiderAccount];
    await db.membership.createMany({
      data: [
        { userId: ownerAccount.userId, businessId: business.id, role: 'OWNER' },
        { userId: viewerAccount.userId, businessId: business.id, role: 'VIEWER' },
        { userId: outsiderAccount.userId, businessId: other.id, role: 'OWNER' },
      ],
    });
  });

  const base = (businessId = business.id) => `/api/v1/businesses/${businessId}/imports`;
  const auth = (token?: string) => (token ? { authorization: `Bearer ${token}` } : {});

  function upload(
    file: Buffer | string,
    source: ImportSource,
    fileName: string,
    {
      token = owner.token,
      contentType = fileName.endsWith('.xlsx') ? XLSX_TYPE : 'text/csv',
      businessId = business.id,
    }: { token?: string; contentType?: string; businessId?: string } = {},
  ) {
    const query = new URLSearchParams({ source, fileName });
    return app.inject({
      method: 'POST',
      url: `${base(businessId)}?${query}`,
      headers: { ...auth(token), 'content-type': contentType },
      payload: file,
    });
  }

  async function uploaded(file: Buffer | string, source: ImportSource, fileName: string) {
    const res = await upload(file, source, fileName);
    expect(res.statusCode, res.body).toBe(201);
    return detailOf(res);
  }

  const get = (id: string, token = owner.token) =>
    app.inject({ method: 'GET', url: `${base()}/${id}`, headers: auth(token) });
  const map = (id: string, mapping: ColumnMapping, token = owner.token) =>
    app.inject({
      method: 'PUT',
      url: `${base()}/${id}/mapping`,
      headers: auth(token),
      payload: { mapping },
    });
  const confirm = (id: string, includePossibleDuplicates?: number[], token = owner.token) =>
    app.inject({
      method: 'POST',
      url: `${base()}/${id}/confirm`,
      headers: auth(token),
      ...(includePossibleDuplicates && { payload: { includePossibleDuplicates } }),
    });
  const cancel = (id: string, token = owner.token) =>
    app.inject({ method: 'DELETE', url: `${base()}/${id}`, headers: auth(token) });

  async function confirmed(id: string, include?: number[]) {
    const res = await confirm(id, include);
    expect(res.statusCode, res.body).toBe(200);
    return detailOf(res).batch;
  }

  describe('uploading', () => {
    it('previews the Montra template without saving any transaction', async () => {
      const detail = await uploaded(fixture('template.csv'), 'MONTRA_TEMPLATE', 'October.csv');

      expect(detail.batch).toMatchObject({
        source: 'MONTRA_TEMPLATE',
        fileFormat: 'CSV',
        fileName: 'October.csv',
        status: 'READY',
        totalRecords: 8,
        importedRecords: 0,
        completedAt: null,
        expiresAt: expect.any(String),
      });
      expect(detail.preview!.summary).toEqual({
        total: 8,
        valid: 4,
        invalid: 4,
        duplicates: 0,
        possibleDuplicates: 0,
      });
      expect(detail.preview!.entries[2]).toMatchObject({
        row: 4,
        status: 'INVALID',
        issues: [{ field: 'amount', message: '“abc” is not an amount.' }],
        cells: ['2026-10-03', 'Expense', 'abc', 'Broken amount', 'Software', '', ''],
      });
      expect(detail.columns[0]).toBe('Date');
      expect(detail.sampleRows).toHaveLength(5);
      expect(await db.transaction.count()).toBe(0);

      const stored = await db.importBatch.findUniqueOrThrow({ where: { id: detail.batch.id } });
      expect(stored.fileSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(stored.pendingData).not.toBeNull();
    });

    it('reads Excel workbooks, with date and number cells', async () => {
      const workbook = writeXlsx([
        ['Date', 'Type', 'Amount', 'Description', 'Category', 'Currency', 'External ID'],
        [{ date: '2026-10-01' }, 'Income', 1500, 'Wholesale order', 'Sales', 'EUR', 'INV-9'],
        [{ date: '2026-10-02' }, 'Expense', 12.5, 'Ads', 'Advertising', null, null],
      ]);
      const detail = await uploaded(workbook, 'MONTRA_TEMPLATE', 'template.xlsx');
      expect(detail.batch.fileFormat).toBe('XLSX');
      expect(detail.preview!.entries.map((entry) => entry.transaction)).toEqual([
        {
          type: 'INCOME',
          amountCents: 150_000,
          description: 'Wholesale order',
          category: 'Sales',
          date: '2026-10-01',
          externalId: 'INV-9',
        },
        {
          type: 'EXPENSE',
          amountCents: 1250,
          description: 'Ads',
          category: 'Advertising',
          date: '2026-10-02',
          externalId: null,
        },
      ]);
    });

    it('reads CSV saved by Excel on Windows (Windows-1252)', async () => {
      const csv = Buffer.concat([
        Buffer.from('Date,Type,Amount,Description,Category\r\n2026-10-01,Expense,4.50,Caf'),
        Buffer.from([0xe9]),
        Buffer.from(' latte,Office\r\n'),
      ]);
      const detail = await uploaded(csv, 'MONTRA_TEMPLATE', 'latte.csv');
      expect(detail.preview!.entries[0]!.transaction!.description).toBe('Café latte');
    });

    it.each([
      ['an empty file', '', 'empty.csv', 'MONTRA_TEMPLATE', 400, 'IMPORT_FILE_EMPTY'],
      [
        'a legacy .xls',
        Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 1, 2]),
        'a.xlsx',
        'GENERIC_EXCEL',
        415,
        'IMPORT_UNSUPPORTED_FILE',
      ],
      ['a PDF', '%PDF-1.7 ...', 'a.csv', 'GENERIC_CSV', 415, 'IMPORT_UNSUPPORTED_FILE'],
      [
        'binary data',
        Buffer.from([1, 0, 2, 0, 3]),
        'a.csv',
        'GENERIC_CSV',
        415,
        'IMPORT_UNSUPPORTED_FILE',
      ],
      [
        'a .txt file',
        'Date,Amount\n2026-10-01,5\n',
        'a.txt',
        'GENERIC_CSV',
        415,
        'IMPORT_UNSUPPORTED_FILE',
      ],
      [
        'a workbook as generic CSV',
        writeXlsx([['a'], ['b']]),
        'a.xlsx',
        'GENERIC_CSV',
        422,
        'IMPORT_SOURCE_MISMATCH',
      ],
      [
        'a CSV as generic Excel',
        'a,b\n1,2\n',
        'a.csv',
        'GENERIC_EXCEL',
        422,
        'IMPORT_SOURCE_MISMATCH',
      ],
      [
        'an unclosed quote',
        'Date,Description\n"2026-10-01,x\n',
        'a.csv',
        'GENERIC_CSV',
        422,
        'IMPORT_FILE_UNREADABLE',
      ],
      [
        'a header without data',
        'Date,Amount\n',
        'a.csv',
        'GENERIC_CSV',
        422,
        'IMPORT_FILE_UNREADABLE',
      ],
      [
        'a damaged workbook',
        Buffer.from('PK\u0003\u0004 broken'),
        'a.xlsx',
        'GENERIC_EXCEL',
        422,
        'IMPORT_FILE_UNREADABLE',
      ],
      [
        'a file that is not the template',
        'Date,Amount\n2026-10-01,5\n',
        'a.csv',
        'MONTRA_TEMPLATE',
        422,
        'IMPORT_COLUMNS_MISSING',
      ],
    ] as const)('refuses %s', async (_label, file, fileName, source, status, code) => {
      const res = await upload(file, source, fileName);
      expect(res.statusCode).toBe(status);
      expect(errorOf(res).code).toBe(code);
      expect(await db.importBatch.count()).toBe(0);
    });

    it('lists the template columns a file lacks', async () => {
      const res = await upload(
        'Date,Amount,Description\n2026-10-01,5,x\n',
        'MONTRA_TEMPLATE',
        'a.csv',
      );
      expect(errorOf(res)).toMatchObject({ details: { missing: ['Type', 'Category'] } });
    });

    it('refuses forms and JSON: the body must be the file', async () => {
      const form = await upload(
        '--x\r\nContent-Disposition: form-data\r\n',
        'GENERIC_CSV',
        'a.csv',
        {
          contentType: 'multipart/form-data; boundary=x',
        },
      );
      expect(form.statusCode).toBe(415);
      const json = await upload('{"rows":[]}', 'GENERIC_CSV', 'a.csv', {
        contentType: 'application/json',
      });
      expect(json.statusCode).toBe(415);
    });

    it('limits file size and rows', async () => {
      const big = await upload(Buffer.alloc(5 * 1024 * 1024 + 1, 'a'), 'GENERIC_CSV', 'big.csv');
      expect(big.statusCode).toBe(413);
      expect(errorOf(big)).toMatchObject({
        code: 'IMPORT_FILE_TOO_LARGE',
        message: 'The file is larger than 5 MB.',
      });

      const rows = Array.from({ length: 5001 }, (_, i) => `2026-10-01,Row ${i},1`).join('\n');
      const many = await upload(`Date,Description,Amount\n${rows}\n`, 'GENERIC_CSV', 'many.csv');
      expect(many.statusCode).toBe(422);
      expect(errorOf(many).code).toBe('IMPORT_TOO_MANY_ROWS');
    });

    it('requires the source and file name', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `${base()}?source=SQUARE`,
        headers: { ...auth(owner.token), 'content-type': 'text/csv' },
        payload: 'a,b\n1,2\n',
      });
      expect(res.statusCode).toBe(400);
      expect(errorOf(res).code).toBe('VALIDATION_ERROR');
    });
  });

  describe('mapping generic files', () => {
    it('suggests columns, asks for what is missing, then previews and imports', async () => {
      const detail = await uploaded(fixture('bank-statement.csv'), 'GENERIC_CSV', 'statement.csv');
      expect(detail.batch.status).toBe('AWAITING_MAPPING');
      expect(detail.columns).toEqual(['Дата', 'Описание', 'Сума', 'Валута', 'Референция']);
      expect(detail.mapping).toMatchObject({
        columns: { date: 0, description: 1, amount: 2, currency: 3, externalId: 4 },
        dateFormat: 'DMY',
        decimalSeparator: ',',
      });
      expect(detail.missing).toEqual(['category']);
      expect(detail.preview).toBeNull();
      expect(detail.sampleRows[1]).toEqual([
        '02.10.2026',
        'Facebook Ads',
        '-310,45',
        'EUR',
        'TX-1002',
      ]);

      const early = await confirm(detail.batch.id);
      expect(early.statusCode).toBe(409);
      expect(errorOf(early).code).toBe('IMPORT_MAPPING_INCOMPLETE');

      const mapping = { columns: detail.mapping!.columns, defaultCategory: 'Bank' };
      const mapped = detailOf(await map(detail.batch.id, mapping));
      expect(mapped.batch).toMatchObject({ status: 'READY', totalRecords: 4 });
      expect(mapped.preview!.summary.valid).toBe(4);

      expect(await confirmed(detail.batch.id)).toMatchObject({
        status: 'COMPLETED',
        importedRecords: 4,
        skippedRecords: 0,
        failedRecords: 0,
      });
      const saved = await db.transaction.findMany({ orderBy: { date: 'asc' } });
      expect(saved.map((t) => [t.type, t.amountCents, t.category, t.externalId])).toEqual([
        ['INCOME', 125_000, 'Bank', 'TX-1001'],
        ['EXPENSE', 31_045, 'Bank', 'TX-1002'],
        ['EXPENSE', 80_000, 'Bank', 'TX-1003'],
        ['EXPENSE', 4280, 'Bank', 'TX-1004'],
      ]);
      expect(
        saved.every((t) => t.importSource === 'GENERIC_CSV' && t.importBatchId === detail.batch.id),
      ).toBe(true);
    });

    it('asks for the date format when the dates could be read either way', async () => {
      const detail = await uploaded(
        'Date,Description,Amount,Category\n01/02/2026,Stock,-5,Inventory\n',
        'GENERIC_CSV',
        'a.csv',
      );
      expect(detail.missing).toEqual(['dateFormat']);
      const mapped = detailOf(
        await map(detail.batch.id, { ...detail.mapping!, dateFormat: 'MDY' }),
      );
      expect(mapped.preview!.entries[0]!.transaction).toMatchObject({ date: '2026-01-02' });
    });

    it('maps Excel files by their headers', async () => {
      const workbook = writeXlsx([
        ['Booking date', 'Details', 'Value', 'Category'],
        ['15/10/2026', 'Courier', '-12,40', 'Shipping'],
      ]);
      const detail = await uploaded(workbook, 'GENERIC_EXCEL', 'bank.xlsx');
      expect(detail.batch.status).toBe('READY');
      expect(detail.preview!.entries[0]!.transaction).toMatchObject({
        type: 'EXPENSE',
        amountCents: 1240,
        date: '2026-10-15',
      });
    });

    it('rejects mappings that do not fit the file', async () => {
      const { batch } = await uploaded(fixture('bank-statement.csv'), 'GENERIC_CSV', 'a.csv');
      const missingColumn = await map(batch.id, {
        columns: { date: 0, description: 1, amount: 9 },
      });
      expect(missingColumn.statusCode).toBe(400);
      expect(errorOf(missingColumn).details).toEqual([
        { path: 'mapping.columns.amount', message: 'The file has no column 9.' },
      ]);
      const twice = await map(batch.id, { columns: { date: 0, description: 0, amount: 2 } });
      expect(twice.statusCode).toBe(400);
    });
  });

  describe('import sources', () => {
    it.each(['SHOPIFY', 'WOOCOMMERCE'])('no longer accepts %s exports', async (source) => {
      const res = await app.inject({
        method: 'POST',
        url: `${base()}?source=${source}&fileName=orders.csv`,
        headers: { ...auth(owner.token), 'content-type': 'text/csv' },
        payload: 'Name,Total\n#1001,10\n',
      });
      expect(res.statusCode).toBe(400);
      expect(errorOf(res)).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: [expect.objectContaining({ path: 'source' })],
      });
      expect(await db.importBatch.count()).toBe(0);
    });

    it('explains how a generic file is read', async () => {
      const detail = await uploaded(fixture('bank-statement.csv'), 'GENERIC_CSV', 'a.csv');
      const mapped = detailOf(
        await map(detail.batch.id, { columns: detail.mapping!.columns, defaultCategory: 'Bank' }),
      );
      expect(mapped.notices).toEqual([
        'Dates are read day first: 05.10.2026 is 5 October 2026.',
        'Amounts use a comma for decimals: 1.250,50 means 1250.50.',
        'There is no type column: negative amounts are imported as expenses, others as income.',
        'There is no category column: every record is filed under “Bank”.',
      ]);
    });

    it('imports the template from CSV and from Excel alike', async () => {
      const rows = [
        ['Date', 'Type', 'Amount', 'Description', 'Category', 'External ID'],
        ['2026-10-01', 'Income', '1500.00', 'Wholesale order', 'Sales', 'INV-1'],
      ];
      const csv = await uploaded(
        rows.map((r) => r.join(',')).join('\n'),
        'MONTRA_TEMPLATE',
        'a.csv',
      );
      expect(await confirmed(csv.batch.id)).toMatchObject({
        status: 'COMPLETED',
        importedRecords: 1,
      });

      // The same record from a workbook is recognised by its id.
      const xlsx = await uploaded(writeXlsx(rows), 'MONTRA_TEMPLATE', 'a.xlsx');
      expect(xlsx.preview!.entries.map((entry) => entry.status)).toEqual(['DUPLICATE']);
      expect(await db.transaction.findMany()).toEqual([
        expect.objectContaining({ importSource: 'MONTRA_TEMPLATE', externalId: 'INV-1' }),
      ]);
    });
  });

  describe('duplicates', () => {
    it('never imports a record with a known external id twice', async () => {
      const importStatement = async (fileName: string) => {
        const detail = await uploaded(fixture('bank-statement.csv'), 'GENERIC_CSV', fileName);
        return detailOf(
          await map(detail.batch.id, { columns: detail.mapping!.columns, defaultCategory: 'Bank' }),
        );
      };
      const first = await importStatement('october.csv');
      await confirmed(first.batch.id);

      const again = await importStatement('october (1).csv');
      expect(again.previousImportId).toBe(first.batch.id);
      expect(again.preview!.summary).toMatchObject({ valid: 0, duplicates: 4 });
      expect(again.preview!.entries[0]).toMatchObject({
        status: 'DUPLICATE',
        duplicateOf: expect.any(String),
        notes: ['Already imported (id TX-1001).'],
      });

      // Listing them as possible duplicates does not bring them in.
      expect(await confirmed(again.batch.id, [0, 1, 2])).toMatchObject({
        status: 'COMPLETED',
        importedRecords: 0,
        skippedRecords: 4,
      });
      expect(await db.transaction.count()).toBe(4);
    });

    it('flags records without ids that match existing ones, and imports only those chosen', async () => {
      await confirmed(
        (await uploaded(fixture('template.csv'), 'MONTRA_TEMPLATE', 'a.csv')).batch.id,
      );
      expect(await db.transaction.count()).toBe(4);

      const again = await uploaded(fixture('template.csv'), 'MONTRA_TEMPLATE', 'a.csv');
      const { entries, summary } = again.preview!;
      expect(summary).toMatchObject({ valid: 0, duplicates: 1, possibleDuplicates: 3, invalid: 4 });
      const coffee = entries.filter(
        (entry) =>
          entry.status === 'POSSIBLE_DUPLICATE' &&
          entry.transaction!.description === 'Coffee beans',
      );
      expect(coffee).toHaveLength(2);
      // Each existing record is matched once: two stored coffees, two flagged.
      expect(new Set(coffee.map((entry) => entry.duplicateOf)).size).toBe(2);

      expect(await confirmed(again.batch.id, [coffee[0]!.index])).toMatchObject({
        importedRecords: 1,
        skippedRecords: 3,
        failedRecords: 4,
      });
      expect(await db.transaction.count({ where: { description: 'Coffee beans' } })).toBe(3);
    });

    it('keeps identical records within one file, and matches a hand-entered transaction', async () => {
      const manual = await db.transaction.create({
        data: {
          businessId: business.id,
          type: 'EXPENSE',
          amountCents: 8999,
          description: 'website   HOSTING',
          category: 'Software',
          date: new Date('2026-10-02'),
        },
      });
      const detail = await uploaded(fixture('template.csv'), 'MONTRA_TEMPLATE', 'a.csv');
      const statuses = detail.preview!.entries.map((entry) => entry.status);
      expect(statuses).toEqual([
        'VALID',
        'POSSIBLE_DUPLICATE',
        'INVALID',
        'INVALID',
        'INVALID',
        'INVALID',
        'VALID',
        'VALID',
      ]);
      expect(detail.preview!.entries[1]!.duplicateOf).toBe(manual.id);
    });

    it('treats a repeated id within one file as a duplicate', async () => {
      const csv =
        'Date,Type,Amount,Description,Category,External ID\n2026-10-01,Income,5,A,Sales,X-1\n2026-10-02,Income,6,B,Sales,X-1\n';
      const detail = await uploaded(csv, 'MONTRA_TEMPLATE', 'a.csv');
      expect(detail.preview!.entries.map((entry) => [entry.status, entry.notes])).toEqual([
        ['VALID', []],
        ['DUPLICATE', ['The id X-1 appears earlier in this file.']],
      ]);
    });
  });

  describe('confirming', () => {
    it('marks an import whose every record is invalid as failed', async () => {
      const detail = await uploaded(
        'Date,Type,Amount,Description,Category\n2026-10-01,Income,abc,A,Sales\nnope,Income,5,B,Sales\n',
        'MONTRA_TEMPLATE',
        'a.csv',
      );
      expect(await confirmed(detail.batch.id)).toMatchObject({
        status: 'FAILED',
        totalRecords: 2,
        importedRecords: 0,
        failedRecords: 2,
        completedAt: expect.any(String),
        expiresAt: null,
      });
      expect(
        await db.importBatch.findUniqueOrThrow({ where: { id: detail.batch.id } }),
      ).toMatchObject({ pendingData: null });
    });

    it('confirms once, even when asked twice at the same moment', async () => {
      const { batch } = await uploaded(fixture('template.csv'), 'MONTRA_TEMPLATE', 'a.csv');
      const results = await Promise.all([confirm(batch.id), confirm(batch.id)]);
      expect(results.map((res) => res.statusCode).sort()).toEqual([200, 409]);
      expect(await db.transaction.count()).toBe(4);
    });

    it('saves nothing, and stays ready, if saving any record fails', async () => {
      const { batch } = await uploaded(fixture('template.csv'), 'MONTRA_TEMPLATE', 'a.csv');
      await db.$executeRawUnsafe(`
        CREATE FUNCTION montra_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.description = 'Coffee beans' THEN RAISE EXCEPTION 'simulated failure'; END IF;
          RETURN NEW;
        END $$`);
      await db.$executeRawUnsafe(
        'CREATE TRIGGER montra_test_fail BEFORE INSERT ON "Transaction" FOR EACH ROW EXECUTE FUNCTION montra_test_fail()',
      );
      try {
        const failed = await confirm(batch.id);
        expect(failed.statusCode).toBe(500);
        expect(await db.transaction.count()).toBe(0);
        expect(await db.importBatch.findUniqueOrThrow({ where: { id: batch.id } })).toMatchObject({
          status: 'READY',
          importedRecords: 0,
          completedAt: null,
          pendingData: expect.anything(),
        });
      } finally {
        await db.$executeRawUnsafe('DROP TRIGGER montra_test_fail ON "Transaction"');
        await db.$executeRawUnsafe('DROP FUNCTION montra_test_fail()');
      }
      expect(await confirmed(batch.id)).toMatchObject({ status: 'COMPLETED', importedRecords: 4 });
    });

    it('can be cancelled before confirming, which discards the parsed data', async () => {
      const { batch } = await uploaded(fixture('template.csv'), 'MONTRA_TEMPLATE', 'a.csv');
      const cancelled = detailOf(await cancel(batch.id));
      expect(cancelled).toMatchObject({
        batch: { status: 'CANCELLED' },
        preview: null,
        columns: [],
      });
      expect(await db.importBatch.findUniqueOrThrow({ where: { id: batch.id } })).toMatchObject({
        pendingData: null,
      });

      for (const res of [
        await confirm(batch.id),
        await cancel(batch.id),
        await map(batch.id, { columns: {} }),
      ]) {
        expect(res.statusCode).toBe(409);
        expect(errorOf(res).code).toBe('IMPORT_NOT_PENDING');
      }
    });

    it('expires unconfirmed uploads after their time limit', async () => {
      const { batch } = await uploaded(fixture('template.csv'), 'MONTRA_TEMPLATE', 'a.csv');
      await db.importBatch.update({
        where: { id: batch.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      expect(detailOf(await get(batch.id))).toMatchObject({
        batch: { status: 'EXPIRED' },
        preview: null,
      });
      expect(errorOf(await confirm(batch.id)).code).toBe('IMPORT_NOT_PENDING');
      expect(await db.importBatch.findUniqueOrThrow({ where: { id: batch.id } })).toMatchObject({
        pendingData: null,
      });
    });

    it('allows a limited number of unconfirmed uploads at once', async () => {
      const ids: string[] = [];
      for (let i = 0; i < 5; i++) {
        ids.push((await uploaded(fixture('template.csv'), 'MONTRA_TEMPLATE', `${i}.csv`)).batch.id);
      }
      const sixth = await upload(fixture('template.csv'), 'MONTRA_TEMPLATE', '6.csv');
      expect(sixth.statusCode).toBe(409);
      expect(errorOf(sixth).code).toBe('IMPORT_TOO_MANY_PENDING');

      await cancel(ids[0]!);
      await uploaded(fixture('template.csv'), 'MONTRA_TEMPLATE', '6.csv');
      const list = importListResponseSchema.parse(
        (await app.inject({ method: 'GET', url: base(), headers: auth(owner.token) })).json(),
      );
      expect(list.items.map((item) => item.fileName)).toEqual([
        '6.csv',
        '4.csv',
        '3.csv',
        '2.csv',
        '1.csv',
        '0.csv',
      ]);
      expect(list.items.at(-1)!.status).toBe('CANCELLED');
    });
  });

  describe('authorization', () => {
    it('lets a viewer look at imports but not upload, map, confirm or cancel', async () => {
      const { batch } = await uploaded(fixture('bank-statement.csv'), 'GENERIC_CSV', 'a.csv');

      expect((await get(batch.id, viewer.token)).statusCode).toBe(200);
      expect(
        (await app.inject({ method: 'GET', url: base(), headers: auth(viewer.token) })).statusCode,
      ).toBe(200);
      for (const res of [
        await upload(fixture('template.csv'), 'MONTRA_TEMPLATE', 'a.csv', { token: viewer.token }),
        await map(
          batch.id,
          { columns: { date: 0, description: 1, amount: 2 }, defaultCategory: 'X' },
          viewer.token,
        ),
        await confirm(batch.id, [], viewer.token),
        await cancel(batch.id, viewer.token),
      ]) {
        expect(res.statusCode).toBe(403);
        expect(errorOf(res).code).toBe('FORBIDDEN');
      }
      expect(await db.importBatch.findUniqueOrThrow({ where: { id: batch.id } })).toMatchObject({
        status: 'AWAITING_MAPPING',
      });
      expect(await db.importBatch.count()).toBe(1);
    });

    it('hides imports from other businesses and anonymous callers', async () => {
      const { batch } = await uploaded(fixture('template.csv'), 'MONTRA_TEMPLATE', 'a.csv');
      for (const res of [
        await get(batch.id, outsider.token),
        await confirm(batch.id, [], outsider.token),
        await upload(fixture('template.csv'), 'MONTRA_TEMPLATE', 'a.csv', {
          token: outsider.token,
        }),
      ]) {
        expect(res.statusCode).toBe(404);
      }
      // The outsider's own business does not have this import either.
      const viaOwn = await app.inject({
        method: 'POST',
        url: `${base(other.id)}/${batch.id}/confirm`,
        headers: auth(outsider.token),
      });
      expect(viaOwn.statusCode).toBe(404);
      expect(errorOf(viaOwn).message).toBe('Import not found.');

      for (const res of [
        await get(batch.id, ''),
        await upload(fixture('template.csv'), 'MONTRA_TEMPLATE', 'a.csv', { token: '' }),
      ]) {
        expect(res.statusCode).toBe(401);
      }
      expect(await db.transaction.count()).toBe(0);
    });
  });

  describe('template download', () => {
    it('serves the template as CSV or Excel, without signing in', async () => {
      const csv = await app.inject({ method: 'GET', url: '/api/v1/imports/template?format=csv' });
      expect(csv.statusCode).toBe(200);
      expect(csv.headers['content-type']).toContain('text/csv');
      expect(csv.headers['content-disposition']).toBe('attachment; filename="montra-template.csv"');
      expect(csv.body).toBe('﻿Date,Type,Amount,Description,Category,Currency,External ID\r\n');

      const xlsx = await app.inject({ method: 'GET', url: '/api/v1/imports/template' });
      expect(xlsx.headers['content-type']).toBe(XLSX_TYPE);
      expect(readXlsx(xlsx.rawPayload, 10)).toEqual([
        {
          row: 1,
          cells: ['Date', 'Type', 'Amount', 'Description', 'Category', 'Currency', 'External ID'],
        },
      ]);
    });
  });
});
