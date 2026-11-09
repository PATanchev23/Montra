import {
  TRANSACTION_ERROR_CODES,
  type CreateTransactionRequest,
  type Transaction,
  type TransactionCategoryListResponse,
  type TransactionListQuery,
  type TransactionListResponse,
  type TransactionSort,
  type UpdateTransactionRequest,
} from '@montra/shared';
import type { Db } from '../../db';
import type { Prisma } from '../../generated/prisma/client';
import type { TransactionGetPayload } from '../../generated/prisma/models';
import { AppError } from '../../lib/app-error';

/*
 * Every query here is scoped by businessId as well as the transaction id, so
 * a transaction is only ever found through the business the caller was
 * authorised for. Routes check membership and role before calling in.
 */

export const transactionSelect = {
  id: true,
  type: true,
  amountCents: true,
  description: true,
  category: true,
  date: true,
  importSource: true,
  importBatchId: true,
  externalId: true,
  createdAt: true,
  updatedAt: true,
} as const;

type TransactionRow = TransactionGetPayload<{ select: typeof transactionSelect }>;

/** `@db.Date` columns travel as UTC midnight. */
export const toDbDate = (date: string) => new Date(`${date}T00:00:00.000Z`);
export const fromDbDate = (date: Date) => date.toISOString().slice(0, 10);

export function toTransaction(row: TransactionRow): Transaction {
  return {
    ...row,
    date: fromDbDate(row.date),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const notFound = () => new AppError(404, 'NOT_FOUND', 'Transaction not found.');

/** Amounts are stored in the business currency only; another currency is refused, never converted. */
async function assertBusinessCurrency(db: Db, businessId: string, currency: string | undefined) {
  if (currency === undefined) return;
  const business = await db.business.findUniqueOrThrow({
    where: { id: businessId },
    select: { currency: true },
  });
  if (business.currency !== currency) {
    throw new AppError(
      422,
      TRANSACTION_ERROR_CODES.CURRENCY_MISMATCH,
      `This business records amounts in ${business.currency}. Convert the amount before adding it.`,
    );
  }
}

const orderBy: Record<TransactionSort, Prisma.TransactionOrderByWithRelationInput[]> = {
  date_desc: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
  date_asc: [{ date: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  amount_desc: [{ amountCents: 'desc' }, { date: 'desc' }, { id: 'desc' }],
  amount_asc: [{ amountCents: 'asc' }, { date: 'desc' }, { id: 'desc' }],
};

export async function listTransactions(
  db: Db,
  businessId: string,
  { page, pageSize, type, category, from, to, sort }: TransactionListQuery,
): Promise<TransactionListResponse> {
  const where: Prisma.TransactionWhereInput = {
    businessId,
    ...(type && { type }),
    ...(category && { category: { equals: category, mode: 'insensitive' } }),
    ...((from || to) && {
      date: { ...(from && { gte: toDbDate(from) }), ...(to && { lte: toDbDate(to) }) },
    }),
  };
  const [total, rows] = await db.$transaction([
    db.transaction.count({ where }),
    db.transaction.findMany({
      where,
      orderBy: orderBy[sort],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: transactionSelect,
    }),
  ]);
  return {
    items: rows.map(toTransaction),
    page,
    pageSize,
    total,
    pageCount: Math.ceil(total / pageSize),
  };
}

/** The categories in use, merged case-insensitively under their most used spelling. */
export async function listCategories(
  db: Db,
  businessId: string,
): Promise<TransactionCategoryListResponse> {
  const groups = await db.transaction.groupBy({
    by: ['category', 'type'],
    where: { businessId },
    _count: { _all: true },
  });
  const merged = new Map<
    string,
    { spellings: Map<string, number>; incomeCount: number; expenseCount: number }
  >();
  for (const { category, type, _count } of groups) {
    const key = category.toLocaleLowerCase('en');
    const entry = merged.get(key) ?? { spellings: new Map(), incomeCount: 0, expenseCount: 0 };
    entry.spellings.set(category, (entry.spellings.get(category) ?? 0) + _count._all);
    if (type === 'INCOME') entry.incomeCount += _count._all;
    else entry.expenseCount += _count._all;
    merged.set(key, entry);
  }
  const items = [...merged.values()].map(({ spellings, incomeCount, expenseCount }) => {
    // Most used spelling; ties go to the alphabetically first, so the answer is stable.
    const [name] = [...spellings].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]!;
    return { name, incomeCount, expenseCount };
  });
  items.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  return { items };
}

export async function getTransaction(
  db: Db,
  businessId: string,
  transactionId: string,
): Promise<Transaction> {
  const row = await db.transaction.findFirst({
    where: { id: transactionId, businessId },
    select: transactionSelect,
  });
  if (!row) throw notFound();
  return toTransaction(row);
}

export async function createTransaction(
  db: Db,
  businessId: string,
  { currency, date, ...fields }: CreateTransactionRequest,
): Promise<Transaction> {
  await assertBusinessCurrency(db, businessId, currency);
  const row = await db.transaction.create({
    data: { ...fields, date: toDbDate(date), businessId },
    select: transactionSelect,
  });
  return toTransaction(row);
}

export async function updateTransaction(
  db: Db,
  businessId: string,
  transactionId: string,
  { currency, date, ...fields }: UpdateTransactionRequest,
): Promise<Transaction> {
  await assertBusinessCurrency(db, businessId, currency);
  const { count } = await db.transaction.updateMany({
    where: { id: transactionId, businessId },
    data: { ...fields, ...(date && { date: toDbDate(date) }) },
  });
  if (count === 0) throw notFound();
  return getTransaction(db, businessId, transactionId);
}

export async function deleteTransaction(
  db: Db,
  businessId: string,
  transactionId: string,
): Promise<void> {
  const { count } = await db.transaction.deleteMany({ where: { id: transactionId, businessId } });
  if (count === 0) throw notFound();
}
