import type { ImportEntry } from '@montra/shared';
import type { Db } from '../../db';
import { fromDbDate, toDbDate } from '../transactions/service';
import type { DraftEntry } from './types';
import { normalizeText } from './values';

/** Works with the client or inside a transaction. */
type TransactionReader = Pick<Db, 'transaction'>;

const fingerprint = (t: { type: string; date: string; amountCents: number; description: string }) =>
  `${t.date}|${t.type}|${t.amountCents}|${normalizeText(t.description)}`;

/**
 * Marks records the business already has.
 *
 * 1. External ids are reliable: a record whose id is already stored, or
 *    appears earlier in the same file, is a DUPLICATE and is never imported.
 * 2. Without matching ids, a record with the same date, type, amount and
 *    description (ignoring case and spacing) as an existing transaction is a
 *    POSSIBLE_DUPLICATE: left out unless the owner includes it. Matching is
 *    one-to-one, so three identical sales in a file against one stored sale
 *    flag one record, not three; identical records within one file are
 *    never flagged against each other, as several equal sales on a day are
 *    normal. Two records with different external ids never match.
 */
export async function markDuplicates(
  db: TransactionReader,
  businessId: string,
  drafts: DraftEntry[],
): Promise<ImportEntry[]> {
  const valid = drafts.flatMap((draft) => (draft.status === 'VALID' ? [draft.transaction!] : []));

  const ids = [...new Set(valid.flatMap((t) => (t.externalId ? [t.externalId] : [])))];
  const byId = new Map(
    (
      await db.transaction.findMany({
        where: { businessId, externalId: { in: ids } },
        select: { id: true, externalId: true },
      })
    ).map((row) => [row.externalId!, row.id]),
  );

  const dates = [...new Set(valid.map((t) => t.date))];
  const amounts = [...new Set(valid.map((t) => t.amountCents))];
  const similar =
    dates.length === 0
      ? []
      : await db.transaction.findMany({
          where: {
            businessId,
            date: { in: dates.map(toDbDate) },
            amountCents: { in: amounts },
          },
          select: {
            id: true,
            type: true,
            date: true,
            amountCents: true,
            description: true,
            externalId: true,
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });
  const pool = new Map<string, { id: string; externalId: string | null; used: boolean }[]>();
  for (const row of similar) {
    const key = fingerprint({ ...row, date: fromDbDate(row.date) });
    const list = pool.get(key) ?? [];
    list.push({ id: row.id, externalId: row.externalId, used: false });
    pool.set(key, list);
  }

  const idsInFile = new Set<string>();
  return drafts.map((draft, index): ImportEntry => {
    const entry: ImportEntry = { ...draft, index, duplicateOf: null };
    if (draft.status !== 'VALID') return entry;
    const transaction = draft.transaction!;
    const { externalId } = transaction;

    if (externalId) {
      const existing = byId.get(externalId);
      if (existing || idsInFile.has(externalId)) {
        return {
          ...entry,
          status: 'DUPLICATE',
          duplicateOf: existing ?? null,
          notes: [
            ...entry.notes,
            existing
              ? `Already imported (id ${externalId}).`
              : `The id ${externalId} appears earlier in this file.`,
          ],
        };
      }
      idsInFile.add(externalId);
    }

    const match = pool
      .get(fingerprint(transaction))
      ?.find((candidate) => !candidate.used && (!candidate.externalId || !externalId));
    if (match) {
      match.used = true;
      return {
        ...entry,
        status: 'POSSIBLE_DUPLICATE',
        duplicateOf: match.id,
        notes: [
          ...entry.notes,
          'A transaction with the same date, type, amount and description already exists.',
        ],
      };
    }
    return entry;
  });
}
