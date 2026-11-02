import { z } from 'zod';
import {
  importSourceSchema,
  transactionCategorySchema,
  transactionTypeSchema,
} from './transactions';

/** `error.code` values the import endpoints add to the standard error envelope. */
export const IMPORT_ERROR_CODES = {
  FILE_EMPTY: 'IMPORT_FILE_EMPTY',
  FILE_TOO_LARGE: 'IMPORT_FILE_TOO_LARGE',
  /** Not CSV or XLSX (e.g. a legacy .xls or a PDF). */
  UNSUPPORTED_FILE: 'IMPORT_UNSUPPORTED_FILE',
  /** CSV or XLSX, but damaged or without a header row and data. */
  FILE_UNREADABLE: 'IMPORT_FILE_UNREADABLE',
  TOO_MANY_ROWS: 'IMPORT_TOO_MANY_ROWS',
  /** A generic source that does not match the file, e.g. GENERIC_CSV for an .xlsx. */
  SOURCE_MISMATCH: 'IMPORT_SOURCE_MISMATCH',
  /** The file lacks a column the Montra template requires; `details` lists them. */
  COLUMNS_MISSING: 'IMPORT_COLUMNS_MISSING',
  /** The import has finished, been cancelled or expired, so it can no longer change. */
  NOT_PENDING: 'IMPORT_NOT_PENDING',
  /** Confirming before every required column is mapped. */
  MAPPING_INCOMPLETE: 'IMPORT_MAPPING_INCOMPLETE',
  TOO_MANY_PENDING: 'IMPORT_TOO_MANY_PENDING',
} as const;

export const IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
/** Data rows per file; larger histories can be split across files. */
export const IMPORT_MAX_ROWS = 5000;
/** Unconfirmed uploads are discarded after this long. */
export const IMPORT_PENDING_TTL_HOURS = 24;
/** Unconfirmed uploads a business may have at once. */
export const IMPORT_MAX_PENDING = 5;
export const IMPORT_FILE_EXTENSIONS = ['.csv', '.xlsx'] as const;
export const IMPORT_FILE_NAME_MAX_LENGTH = 255;

/** Mirrors the database's ImportFileFormat enum. Detected from the file's bytes. */
export const importFileFormatSchema = z.enum(['CSV', 'XLSX']);
export type ImportFileFormat = z.infer<typeof importFileFormatSchema>;

/**
 * Mirrors the database's ImportStatus enum.
 * AWAITING_MAPPING: uploaded, but required columns or settings are not mapped yet.
 * READY: preview available; nothing is saved until the owner confirms.
 * COMPLETED: confirmed; some records may still have been skipped or invalid.
 * FAILED: confirmed, but no record could be imported because all were invalid.
 * CANCELLED, EXPIRED: discarded before confirmation.
 */
export const importStatusSchema = z.enum([
  'AWAITING_MAPPING',
  'READY',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
]);
export type ImportStatus = z.infer<typeof importStatusSchema>;

/** Transaction fields a file column can be mapped to. */
export const IMPORT_FIELDS = [
  'date',
  'description',
  'amount',
  'type',
  'category',
  'currency',
  'externalId',
] as const;
export const importFieldSchema = z.enum(IMPORT_FIELDS);
export type ImportField = z.infer<typeof importFieldSchema>;

/** YMD: 2026-10-05. DMY: 05.10.2026 or 05/10/2026. MDY: 10/05/2026. */
export const dateFormatSchema = z.enum(['YMD', 'DMY', 'MDY']);
export type DateFormat = z.infer<typeof dateFormatSchema>;

export const decimalSeparatorSchema = z.enum(['.', ',']);
export type DecimalSeparator = z.infer<typeof decimalSeparatorSchema>;

/**
 * Something a file still needs before it can be previewed: a field's column,
 * or the date format when values like 03/04/2026 could be read either way.
 * (The decimal separator never is: amounts have at most two decimals, so
 * only one separator reads every value.)
 */
export const importRequirementSchema = z.enum([...IMPORT_FIELDS, 'dateFormat']);
export type ImportRequirement = z.infer<typeof importRequirementSchema>;

/** The official Montra template, in column order. Headers match case-insensitively. */
export const MONTRA_TEMPLATE_COLUMNS = [
  { field: 'date', header: 'Date', required: true },
  { field: 'type', header: 'Type', required: true },
  { field: 'amount', header: 'Amount', required: true },
  { field: 'description', header: 'Description', required: true },
  { field: 'category', header: 'Category', required: true },
  { field: 'currency', header: 'Currency', required: false },
  { field: 'externalId', header: 'External ID', required: false },
] as const satisfies readonly { field: ImportField; header: string; required: boolean }[];

const columnIndexSchema = z.int().min(0).max(999);

/**
 * How a generic file's columns become transactions. Columns are 0-based
 * positions in the header row. Without a type column, the amount's sign
 * decides: negative is an expense. Settings left out are detected from the
 * values when they are unambiguous.
 */
export const columnMappingSchema = z
  .object({
    columns: z.object({
      date: columnIndexSchema.optional(),
      description: columnIndexSchema.optional(),
      amount: columnIndexSchema.optional(),
      type: columnIndexSchema.optional(),
      category: columnIndexSchema.optional(),
      currency: columnIndexSchema.optional(),
      externalId: columnIndexSchema.optional(),
    }),
    dateFormat: dateFormatSchema.optional(),
    decimalSeparator: decimalSeparatorSchema.optional(),
    /** Used where the category column is unmapped or blank. */
    defaultCategory: transactionCategorySchema.optional(),
  })
  .refine(
    ({ columns }) => {
      const used = Object.values(columns).filter((index) => index !== undefined);
      return new Set(used).size === used.length;
    },
    { error: 'Map each column to one field at most.', path: ['columns'] },
  );
export type ColumnMapping = z.infer<typeof columnMappingSchema>;

/** POST /businesses/:businessId/imports query string; the file is the raw request body. */
export const uploadImportQuerySchema = z.object({
  source: importSourceSchema,
  fileName: z.string().trim().min(1).max(IMPORT_FILE_NAME_MAX_LENGTH),
});
export type UploadImportQuery = z.infer<typeof uploadImportQuerySchema>;

/**
 * VALID: will be imported. INVALID: needs correcting; see `issues`.
 * DUPLICATE: its external id is already imported; never imported again.
 * POSSIBLE_DUPLICATE: same date, type, amount and description as an existing
 * transaction; left out unless the owner includes it.
 */
export const importEntryStatusSchema = z.enum([
  'VALID',
  'INVALID',
  'DUPLICATE',
  'POSSIBLE_DUPLICATE',
]);
export type ImportEntryStatus = z.infer<typeof importEntryStatusSchema>;

export const importedTransactionSchema = z.object({
  type: transactionTypeSchema,
  amountCents: z.int().positive(),
  description: z.string(),
  category: z.string(),
  date: z.iso.date(),
  externalId: z.string().nullable(),
});
export type ImportedTransaction = z.infer<typeof importedTransactionSchema>;

/** One record found in the file. A source row can yield several (e.g. a sale and its fee). */
export const importEntrySchema = z.object({
  /** Position in the preview; stable for the same file and mapping. */
  index: z.int().min(0),
  /** The row as numbered in a spreadsheet: the header is row 1. */
  row: z.int().min(1),
  status: importEntryStatusSchema,
  transaction: importedTransactionSchema.nullable(),
  /** Why the record is INVALID, by field where one is to blame. */
  issues: z.array(z.object({ field: importFieldSchema.nullable(), message: z.string() })),
  /** Why it matched an existing record, or how a value was read. */
  notes: z.array(z.string()),
  /** The existing transaction a DUPLICATE or POSSIBLE_DUPLICATE matches. */
  duplicateOf: z.string().nullable(),
  /** The source row's cells, for INVALID records, so they can be found and fixed. */
  cells: z.array(z.string()).nullable(),
});
export type ImportEntry = z.infer<typeof importEntrySchema>;

export const importSummarySchema = z.object({
  total: z.int().min(0),
  valid: z.int().min(0),
  invalid: z.int().min(0),
  duplicates: z.int().min(0),
  possibleDuplicates: z.int().min(0),
});
export type ImportSummary = z.infer<typeof importSummarySchema>;

/**
 * An upload and what became of it. Once finished:
 * totalRecords = importedRecords + skippedRecords + failedRecords, where
 * skipped covers duplicates and the possible duplicates left out, and failed
 * covers invalid records.
 */
export const importBatchSchema = z.object({
  id: z.string(),
  source: importSourceSchema,
  fileFormat: importFileFormatSchema,
  fileName: z.string(),
  fileSize: z.int().min(0),
  status: importStatusSchema,
  totalRecords: z.int().min(0),
  importedRecords: z.int().min(0),
  skippedRecords: z.int().min(0),
  failedRecords: z.int().min(0),
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  /** When an unconfirmed upload is discarded; null once finished. */
  expiresAt: z.iso.datetime().nullable(),
});
export type ImportBatch = z.infer<typeof importBatchSchema>;

/** An import with everything needed to map, review and confirm it. */
export const importDetailSchema = z.object({
  batch: importBatchSchema,
  /** The file's header row; empty once the import has finished. */
  columns: z.array(z.string()),
  /** The first few data rows, to help map columns. */
  sampleRows: z.array(z.array(z.string())),
  /** Template and generic files: the mapping in use, with detected settings filled in. */
  mapping: columnMappingSchema.nullable(),
  /** What must still be mapped or chosen before a preview is possible. */
  missing: z.array(importRequirementSchema),
  /** Null while awaiting mapping, and once finished. */
  preview: z
    .object({ summary: importSummarySchema, entries: z.array(importEntrySchema) })
    .nullable(),
  /** A completed import of the identical file, if any. Its records show up as duplicates. */
  previousImportId: z.string().nullable(),
  /** How the whole file is read, e.g. the date format and which columns are ignored. */
  notices: z.array(z.string()),
});
export type ImportDetail = z.infer<typeof importDetailSchema>;

/** PUT /businesses/:businessId/imports/:importId/mapping */
export const updateImportMappingRequestSchema = z.object({ mapping: columnMappingSchema });
export type UpdateImportMappingRequest = z.infer<typeof updateImportMappingRequestSchema>;

/** POST /businesses/:businessId/imports/:importId/confirm */
export const confirmImportRequestSchema = z.object({
  /** Indexes of POSSIBLE_DUPLICATE entries the owner has checked and wants imported anyway. */
  includePossibleDuplicates: z
    .array(z.int().min(0))
    .max(IMPORT_MAX_ROWS * 4)
    .default([]),
});
export type ConfirmImportRequest = z.infer<typeof confirmImportRequestSchema>;

export const importListResponseSchema = z.object({ items: z.array(importBatchSchema) });
export type ImportListResponse = z.infer<typeof importListResponseSchema>;
