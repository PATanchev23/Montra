import {
  columnMappingSchema,
  IMPORT_ERROR_CODES,
  IMPORT_FILE_EXTENSIONS,
  IMPORT_MAX_PENDING,
  IMPORT_MAX_ROWS,
  IMPORT_PENDING_TTL_HOURS,
  type ColumnMapping,
  type ImportBatch,
  type ImportDetail,
  type ImportListResponse,
  type ImportSource,
} from '@montra/shared';
import { createHash } from 'node:crypto';
import { extname } from 'node:path';
import type { Db } from '../../db';
import { Prisma, type ImportStatus } from '../../generated/prisma/client';
import type { ImportBatchGetPayload } from '../../generated/prisma/models';
import { AppError } from '../../lib/app-error';
import { toDbDate } from '../transactions/service';
import { markDuplicates } from './duplicates';
import { templateMapping, suggestMapping } from './mapping';
import { buildPreview, summarize } from './preview';
import { detectFormat, readTable } from './table';
import { cellText, FileReadError, type ParsedTable } from './types';

/*
 * The import workflow: upload → (map columns) → preview → confirm.
 *
 * Nothing reaches the Transaction table before the owner confirms. Until
 * then the batch keeps the parsed cells (never the file), and every preview
 * is recomputed against the business's current transactions. Confirmation
 * re-reads, re-checks duplicates and inserts in one database transaction,
 * holding a per-business lock so two imports cannot interleave.
 */

const PENDING: ImportStatus[] = ['AWAITING_MAPPING', 'READY'];
const SAMPLE_ROWS = 5;

const batchSelect = {
  id: true,
  businessId: true,
  source: true,
  fileFormat: true,
  fileName: true,
  fileSize: true,
  fileSha256: true,
  status: true,
  totalRecords: true,
  importedRecords: true,
  skippedRecords: true,
  failedRecords: true,
  mapping: true,
  pendingData: true,
  expiresAt: true,
  completedAt: true,
  createdAt: true,
} as const;

type BatchRow = ImportBatchGetPayload<{ select: typeof batchSelect }>;
type Tx = Prisma.TransactionClient;

const isPending = (status: ImportStatus) => PENDING.includes(status);

const notFound = () => new AppError(404, 'NOT_FOUND', 'Import not found.');
const notPending = (status: ImportStatus) =>
  new AppError(
    409,
    IMPORT_ERROR_CODES.NOT_PENDING,
    `This import is ${status.toLowerCase().replace('_', ' ')} and can no longer change.`,
  );

function toBatch(row: BatchRow): ImportBatch {
  return {
    id: row.id,
    source: row.source,
    fileFormat: row.fileFormat,
    fileName: row.fileName,
    fileSize: row.fileSize,
    status: row.status,
    totalRecords: row.totalRecords,
    importedRecords: row.importedRecords,
    skippedRecords: row.skippedRecords,
    failedRecords: row.failedRecords,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    expiresAt: isPending(row.status) ? row.expiresAt.toISOString() : null,
  };
}

const readMapping = (value: unknown): ColumnMapping | null =>
  columnMappingSchema.safeParse(value).data ?? null;

/** The parsed cells saved at upload; written only by this module. */
const readTableData = (value: unknown) => value as ParsedTable;

/** Runs `task` in a transaction holding the business's import lock. */
function withImportLock<T>(db: Db, businessId: string, task: (tx: Tx) => Promise<T>) {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`import:${businessId}`}, 0))`;
      return task(tx);
    },
    { maxWait: 10_000, timeout: 60_000 },
  );
}

/** Unconfirmed uploads past their time limit give up their stored cells. */
async function expireStale(db: Db | Tx, businessId: string) {
  await db.importBatch.updateMany({
    where: { businessId, status: { in: PENDING }, expiresAt: { lte: new Date() } },
    data: { status: 'EXPIRED', pendingData: Prisma.DbNull },
  });
}

async function businessCurrency(db: Db | Tx, businessId: string) {
  const { currency } = await db.business.findUniqueOrThrow({
    where: { id: businessId },
    select: { currency: true },
  });
  return currency;
}

async function findBatch(db: Db | Tx, businessId: string, importId: string) {
  const row = await db.importBatch.findFirst({
    where: { id: importId, businessId },
    select: batchSelect,
  });
  if (!row) throw notFound();
  return row;
}

async function describe(db: Db | Tx, row: BatchRow): Promise<ImportDetail> {
  const previous = await db.importBatch.findFirst({
    where: {
      businessId: row.businessId,
      fileSha256: row.fileSha256,
      status: 'COMPLETED',
      id: { not: row.id },
      createdAt: { lt: row.createdAt },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  const detail: ImportDetail = {
    batch: toBatch(row),
    columns: [],
    sampleRows: [],
    mapping: readMapping(row.mapping),
    missing: [],
    preview: null,
    previousImportId: previous?.id ?? null,
    notices: [],
  };
  if (!isPending(row.status)) return detail;

  const table = readTableData(row.pendingData);
  const currency = await businessCurrency(db, row.businessId);
  const preview = buildPreview(row.source, table, detail.mapping, currency);
  const entries = preview.drafts && (await markDuplicates(db, row.businessId, preview.drafts));
  return {
    ...detail,
    columns: table.columns,
    sampleRows: table.rows
      .slice(0, SAMPLE_ROWS)
      .map(({ cells }) => table.columns.map((_, index) => cellText(cells[index]))),
    mapping: preview.mapping,
    missing: preview.missing,
    preview: entries && { summary: summarize(entries), entries },
    notices: preview.notices,
  };
}

const unsupported = (message: string) =>
  new AppError(415, IMPORT_ERROR_CODES.UNSUPPORTED_FILE, message);

export interface UploadInput {
  businessId: string;
  userId: string;
  source: ImportSource;
  fileName: string;
  file: Buffer;
}

/** Validates and parses an upload, and stores it awaiting mapping or confirmation. */
export async function uploadImport(db: Db, input: UploadInput): Promise<ImportDetail> {
  const { businessId, userId, source, fileName, file } = input;
  if (file.length === 0)
    throw new AppError(400, IMPORT_ERROR_CODES.FILE_EMPTY, 'The file is empty.');
  if (!(IMPORT_FILE_EXTENSIONS as readonly string[]).includes(extname(fileName).toLowerCase())) {
    throw unsupported('Upload a .csv or .xlsx file.');
  }
  const detected = detectFormat(file);
  if (!detected.ok) throw unsupported(detected.message);
  const format = detected.format;
  if (
    (source === 'GENERIC_CSV' && format !== 'CSV') ||
    (source === 'GENERIC_EXCEL' && format !== 'XLSX')
  ) {
    throw new AppError(
      422,
      IMPORT_ERROR_CODES.SOURCE_MISMATCH,
      format === 'XLSX'
        ? 'This is an Excel workbook. Import it as an Excel file.'
        : 'This is a CSV file. Import it as a CSV file.',
    );
  }

  let table: ParsedTable;
  try {
    table = readTable(file, format);
  } catch (err) {
    if (err instanceof FileReadError) {
      throw new AppError(422, IMPORT_ERROR_CODES.FILE_UNREADABLE, err.message);
    }
    throw err;
  }
  if (table.rows.length > IMPORT_MAX_ROWS) {
    throw new AppError(
      422,
      IMPORT_ERROR_CODES.TOO_MANY_ROWS,
      `The file has more than ${IMPORT_MAX_ROWS} rows. Split it into smaller files.`,
    );
  }

  let mapping: ColumnMapping;
  if (source === 'MONTRA_TEMPLATE') {
    const template = templateMapping(table.columns);
    if (template.absent.length > 0) {
      throw new AppError(
        422,
        IMPORT_ERROR_CODES.COLUMNS_MISSING,
        `This is not the Montra template. Missing columns: ${template.absent.join(', ')}.`,
        { details: { missing: template.absent } },
      );
    }
    mapping = template.mapping;
  } else {
    mapping = suggestMapping(table.columns);
  }

  const currency = await businessCurrency(db, businessId);
  const preview = buildPreview(source, table, mapping, currency);

  const row = await withImportLock(db, businessId, async (tx) => {
    await expireStale(tx, businessId);
    const pending = await tx.importBatch.count({
      where: { businessId, status: { in: PENDING } },
    });
    if (pending >= IMPORT_MAX_PENDING) {
      throw new AppError(
        409,
        IMPORT_ERROR_CODES.TOO_MANY_PENDING,
        `There are already ${pending} imports waiting for review. Confirm or cancel one first.`,
      );
    }
    return tx.importBatch.create({
      data: {
        businessId,
        createdById: userId,
        source,
        fileFormat: format,
        fileName,
        fileSize: file.length,
        fileSha256: createHash('sha256').update(file).digest('hex'),
        status: preview.drafts ? 'READY' : 'AWAITING_MAPPING',
        totalRecords: preview.drafts?.length ?? 0,
        mapping,
        pendingData: table as unknown as Prisma.InputJsonObject,
        expiresAt: new Date(Date.now() + IMPORT_PENDING_TTL_HOURS * 3_600_000),
      },
      select: batchSelect,
    });
  });
  return describe(db, row);
}

export async function listImports(db: Db, businessId: string): Promise<ImportListResponse> {
  await expireStale(db, businessId);
  const rows = await db.importBatch.findMany({
    where: { businessId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 50,
    select: batchSelect,
  });
  return { items: rows.map(toBatch) };
}

export async function getImport(db: Db, businessId: string, importId: string) {
  await expireStale(db, businessId);
  return describe(db, await findBatch(db, businessId, importId));
}

/** Replaces an import's column mapping and refreshes its status. */
export async function updateMapping(
  db: Db,
  businessId: string,
  importId: string,
  mapping: ColumnMapping,
): Promise<ImportDetail> {
  const row = await withImportLock(db, businessId, async (tx) => {
    await expireStale(tx, businessId);
    const batch = await findBatch(tx, businessId, importId);
    if (!isPending(batch.status)) throw notPending(batch.status);
    const table = readTableData(batch.pendingData);
    for (const [field, index] of Object.entries(mapping.columns)) {
      if (index !== undefined && index >= table.columns.length) {
        throw new AppError(400, 'VALIDATION_ERROR', 'The request is invalid.', {
          details: [
            { path: `mapping.columns.${field}`, message: `The file has no column ${index}.` },
          ],
        });
      }
    }
    const preview = buildPreview(
      batch.source,
      table,
      mapping,
      await businessCurrency(tx, businessId),
    );
    return tx.importBatch.update({
      where: { id: batch.id },
      data: {
        mapping,
        status: preview.drafts ? 'READY' : 'AWAITING_MAPPING',
        totalRecords: preview.drafts?.length ?? 0,
      },
      select: batchSelect,
    });
  });
  return describe(db, row);
}

/** Discards an unconfirmed upload. */
export async function cancelImport(
  db: Db,
  businessId: string,
  importId: string,
): Promise<ImportDetail> {
  const row = await withImportLock(db, businessId, async (tx) => {
    await expireStale(tx, businessId);
    const batch = await findBatch(tx, businessId, importId);
    if (!isPending(batch.status)) throw notPending(batch.status);
    return tx.importBatch.update({
      where: { id: batch.id },
      data: { status: 'CANCELLED', pendingData: Prisma.DbNull },
      select: batchSelect,
    });
  });
  return describe(db, row);
}

/**
 * Imports the valid records, plus any possible duplicates the owner chose,
 * all or nothing. Duplicates are checked again against the data as it is
 * now; a record another import inserted meanwhile is counted as skipped.
 */
export async function confirmImport(
  db: Db,
  businessId: string,
  importId: string,
  includePossibleDuplicates: number[],
): Promise<ImportDetail> {
  const row = await withImportLock(db, businessId, async (tx) => {
    await expireStale(tx, businessId);
    const batch = await findBatch(tx, businessId, importId);
    if (batch.status === 'AWAITING_MAPPING') {
      throw new AppError(
        409,
        IMPORT_ERROR_CODES.MAPPING_INCOMPLETE,
        'Map the required columns before importing.',
      );
    }
    if (batch.status !== 'READY') throw notPending(batch.status);

    const preview = buildPreview(
      batch.source,
      readTableData(batch.pendingData),
      readMapping(batch.mapping),
      await businessCurrency(tx, businessId),
    );
    if (!preview.drafts) {
      throw new AppError(
        409,
        IMPORT_ERROR_CODES.MAPPING_INCOMPLETE,
        'Map the required columns before importing.',
      );
    }
    const entries = await markDuplicates(tx, businessId, preview.drafts);
    const chosen = new Set(includePossibleDuplicates);
    const toImport = entries.filter(
      (entry) =>
        entry.status === 'VALID' ||
        (entry.status === 'POSSIBLE_DUPLICATE' && chosen.has(entry.index)),
    );

    const { count: imported } = await tx.transaction.createMany({
      data: toImport.map(({ transaction }) => ({
        businessId,
        type: transaction!.type,
        amountCents: transaction!.amountCents,
        description: transaction!.description,
        category: transaction!.category,
        date: toDbDate(transaction!.date),
        externalId: transaction!.externalId,
        importSource: batch.source,
        importBatchId: batch.id,
      })),
      // Only external ids can conflict; such a record was imported meanwhile.
      skipDuplicates: true,
    });
    const failed = entries.filter((entry) => entry.status === 'INVALID').length;

    return tx.importBatch.update({
      where: { id: batch.id },
      data: {
        status: imported > 0 || failed === 0 ? 'COMPLETED' : 'FAILED',
        totalRecords: entries.length,
        importedRecords: imported,
        failedRecords: failed,
        skippedRecords: entries.length - imported - failed,
        completedAt: new Date(),
        pendingData: Prisma.DbNull,
      },
      select: batchSelect,
    });
  });
  return describe(db, row);
}
