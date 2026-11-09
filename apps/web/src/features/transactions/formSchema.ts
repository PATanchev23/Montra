import {
  amountCentsSchema,
  toCents,
  transactionCategorySchema,
  transactionDateSchema,
  transactionDescriptionSchema,
  transactionTypeSchema,
  type CreateTransactionRequest,
  type Transaction,
  type UpdateTransactionRequest,
} from '@montra/shared';
import { format } from 'date-fns';
import { z } from 'zod';

/*
 * The transaction form holds what was typed (strings). It validates with the
 * shared schemas, so the browser accepts exactly what the API does; only the
 * amount is typed in currency units and converted to cents here.
 */

const AMOUNT_PATTERN = /^\d+(?:[.,]\d+)?$/;

/** An amount as typed, e.g. "89.99" or "1 250,50", as positive cents. */
export const amountTextSchema = z
  .string()
  .transform((text, ctx) => {
    const compact = text.replace(/\s/g, '');
    if (compact === '') {
      ctx.addIssue({ code: 'custom', message: 'Enter an amount.' });
      return z.NEVER;
    }
    if (/^[-+−]/.test(compact)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Enter the amount without a sign; choose income or expense instead.',
      });
      return z.NEVER;
    }
    if (!AMOUNT_PATTERN.test(compact)) {
      ctx.addIssue({ code: 'custom', message: 'Enter an amount such as 89.99.' });
      return z.NEVER;
    }
    const [, fraction = ''] = compact.split(/[.,]/);
    if (fraction.length > 2) {
      ctx.addIssue({ code: 'custom', message: 'Use at most two decimal places.' });
      return z.NEVER;
    }
    const cents = toCents(Number(compact.replace(',', '.')));
    // Far beyond the largest amount; the shared schema reports it as too large.
    return Number.isSafeInteger(cents) ? cents : Number.MAX_SAFE_INTEGER;
  })
  .pipe(amountCentsSchema);

export const transactionFormSchema = z.object({
  type: transactionTypeSchema,
  amount: amountTextSchema,
  description: transactionDescriptionSchema,
  category: transactionCategorySchema,
  date: transactionDateSchema,
});

export type TransactionFormValues = Record<keyof z.input<typeof transactionFormSchema>, string>;
export type TransactionFormData = z.output<typeof transactionFormSchema>;

/** Cents as an editable amount: 8999 → "89.99". */
export function amountText(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Today on this device, yyyy-mm-dd. */
export const todayIso = () => format(new Date(), 'yyyy-MM-dd');

export function formValuesFrom(transaction: Transaction | null): TransactionFormValues {
  if (!transaction) {
    return { type: 'EXPENSE', amount: '', description: '', category: '', date: todayIso() };
  }
  return {
    type: transaction.type,
    amount: amountText(transaction.amountCents),
    description: transaction.description,
    category: transaction.category,
    date: transaction.date,
  };
}

/** The request that records a new transaction in the business currency. */
export function createRequestFrom(
  data: TransactionFormData,
  currency: string,
): CreateTransactionRequest {
  const { amount, ...fields } = data;
  return {
    ...fields,
    amountCents: amount,
    currency: currency as CreateTransactionRequest['currency'],
  };
}

/** Only the fields that differ from the saved transaction; null when nothing changed. */
export function updateRequestFrom(
  data: TransactionFormData,
  saved: Transaction,
  currency: string,
): UpdateTransactionRequest | null {
  const changes: UpdateTransactionRequest = {};
  if (data.type !== saved.type) changes.type = data.type;
  if (data.amount !== saved.amountCents) changes.amountCents = data.amount;
  if (data.description !== saved.description) changes.description = data.description;
  if (data.category !== saved.category) changes.category = data.category;
  if (data.date !== saved.date) changes.date = data.date;
  if (Object.keys(changes).length === 0) return null;
  return { ...changes, currency: currency as UpdateTransactionRequest['currency'] };
}

/** API validation paths, as form fields. */
const fieldOfPath: Record<string, keyof TransactionFormValues> = {
  type: 'type',
  amountCents: 'amount',
  description: 'description',
  category: 'category',
  date: 'date',
};

/** Field errors from a 400 VALIDATION_ERROR's details, where they name a form field. */
export function fieldErrorsFrom(
  details: unknown,
): Partial<Record<keyof TransactionFormValues, string>> {
  const errors: Partial<Record<keyof TransactionFormValues, string>> = {};
  if (!Array.isArray(details)) return errors;
  for (const detail of details) {
    const { path, message } = (detail ?? {}) as { path?: unknown; message?: unknown };
    if (typeof path !== 'string' || typeof message !== 'string') continue;
    const field = fieldOfPath[path.split('.')[0] ?? ''];
    if (field) errors[field] ??= message;
  }
  return errors;
}
