import { z } from 'zod';
import { currencySchema } from './business';
import { MAX_CENTS } from './money';

/** `error.code` values the transaction endpoints add to the standard error envelope. */
export const TRANSACTION_ERROR_CODES = {
  /** The request names a currency other than the business's; amounts are never converted. */
  CURRENCY_MISMATCH: 'CURRENCY_MISMATCH',
} as const;

/** Mirrors the database's TransactionType enum. */
export const transactionTypeSchema = z.enum(['INCOME', 'EXPENSE'], {
  error: 'Choose income or expense.',
});
export type TransactionType = z.infer<typeof transactionTypeSchema>;

/**
 * Mirrors the database's ImportSource enum: where an imported transaction
 * came from. The official template, or any CSV or Excel file read through a
 * column mapping.
 */
export const importSourceSchema = z.enum(['MONTRA_TEMPLATE', 'GENERIC_CSV', 'GENERIC_EXCEL']);
export type ImportSource = z.infer<typeof importSourceSchema>;

export const TRANSACTION_DESCRIPTION_MAX_LENGTH = 255;
export const TRANSACTION_CATEGORY_MAX_LENGTH = 60;
export const EXTERNAL_ID_MAX_LENGTH = 200;

/** Earliest and latest dates a transaction may carry; outside them is almost always a typo. */
export const TRANSACTION_DATE_MIN = '1900-01-01';
export const TRANSACTION_DATE_MAX = '2199-12-31';

/** A calendar date, yyyy-mm-dd. Transactions have no time of day. */
export const transactionDateSchema = z
  .string({ error: 'Enter a date.' })
  .trim()
  .pipe(
    z.iso
      .date('Enter a real date as YYYY-MM-DD.')
      .refine((date) => date >= TRANSACTION_DATE_MIN && date <= TRANSACTION_DATE_MAX, {
        error: 'Enter a date between 1900 and 2199.',
      }),
  );

/** Always positive, in cents of the business currency; `type` gives the direction. */
export const amountCentsSchema = z
  .int({ error: 'Enter the amount in whole cents.' })
  .min(1, 'The amount must be greater than zero.')
  .max(MAX_CENTS, 'The amount is too large.');

export const transactionDescriptionSchema = z
  .string({ error: 'Enter a description.' })
  .trim()
  .min(1, 'Enter a description.')
  .max(
    TRANSACTION_DESCRIPTION_MAX_LENGTH,
    `Use at most ${TRANSACTION_DESCRIPTION_MAX_LENGTH} characters.`,
  );

/** Free-form label, e.g. "Advertising". Filters match it case-insensitively. */
export const transactionCategorySchema = z
  .string({ error: 'Enter a category.' })
  .trim()
  .min(1, 'Enter a category.')
  .max(
    TRANSACTION_CATEGORY_MAX_LENGTH,
    `Use at most ${TRANSACTION_CATEGORY_MAX_LENGTH} characters.`,
  );

const transactionFields = {
  type: transactionTypeSchema,
  amountCents: amountCentsSchema,
  description: transactionDescriptionSchema,
  category: transactionCategorySchema,
  date: transactionDateSchema,
  /**
   * Optional check: amounts are always in the business currency, so a request
   * naming another currency is refused rather than stored in the wrong unit.
   */
  currency: currencySchema.optional(),
};

/** POST /businesses/:businessId/transactions. Unknown fields (e.g. businessId) are dropped. */
export const createTransactionRequestSchema = z.object(transactionFields);
export type CreateTransactionRequest = z.infer<typeof createTransactionRequestSchema>;

/** PATCH /businesses/:businessId/transactions/:transactionId: only the fields to change. */
export const updateTransactionRequestSchema = z
  .object(transactionFields)
  .partial()
  .refine((fields) => Object.values(fields).some((value) => value !== undefined), {
    error: 'Change at least one field.',
  });
export type UpdateTransactionRequest = z.infer<typeof updateTransactionRequestSchema>;

export const transactionSchema = z.object({
  id: z.string(),
  type: transactionTypeSchema,
  amountCents: z.int().positive(),
  description: z.string(),
  category: z.string(),
  date: z.iso.date(),
  /** Null for transactions entered by hand. */
  importSource: importSourceSchema.nullable(),
  importBatchId: z.string().nullable(),
  /** The source system's id, used to recognise the record on a later import. */
  externalId: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Transaction = z.infer<typeof transactionSchema>;

export const TRANSACTION_SORTS = ['date_desc', 'date_asc', 'amount_desc', 'amount_asc'] as const;
export const transactionSortSchema = z.enum(TRANSACTION_SORTS);
export type TransactionSort = z.infer<typeof transactionSortSchema>;

export const TRANSACTION_PAGE_SIZE_DEFAULT = 25;
export const TRANSACTION_PAGE_SIZE_MAX = 100;

/** GET /businesses/:businessId/transactions query string. Filters combine with AND. */
export const transactionListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(TRANSACTION_PAGE_SIZE_MAX)
      .default(TRANSACTION_PAGE_SIZE_DEFAULT),
    type: transactionTypeSchema.optional(),
    category: transactionCategorySchema.optional(),
    /** Inclusive. */
    from: transactionDateSchema.optional(),
    /** Inclusive. */
    to: transactionDateSchema.optional(),
    /** Newest first by default; ties are broken consistently, so pages never overlap. */
    sort: transactionSortSchema.default('date_desc'),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    error: '`from` must not be after `to`.',
    path: ['from'],
  });
export type TransactionListQuery = z.infer<typeof transactionListQuerySchema>;

export const transactionListResponseSchema = z.object({
  items: z.array(transactionSchema),
  page: z.int().min(1),
  pageSize: z.int().min(1),
  total: z.int().min(0),
  pageCount: z.int().min(0),
});
export type TransactionListResponse = z.infer<typeof transactionListResponseSchema>;
