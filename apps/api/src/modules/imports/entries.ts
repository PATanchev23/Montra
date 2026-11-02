import {
  createTransactionRequestSchema,
  EXTERNAL_ID_MAX_LENGTH,
  type ImportField,
  type TransactionType,
} from '@montra/shared';
import { cellText, type Cell, type DraftEntry, type EntryIssue } from './types';

export interface Candidate {
  type?: TransactionType;
  amountCents?: number;
  description?: string;
  category?: string;
  date?: string;
  externalId?: string | null;
}

const fieldOf: Record<string, ImportField> = {
  type: 'type',
  amountCents: 'amount',
  description: 'description',
  category: 'category',
  date: 'date',
};

/**
 * Checks a record against the same rules as a transaction entered by hand.
 * Any issue makes it INVALID, keeping the source cells so the row can be found.
 */
export function finishEntry(
  row: number,
  candidate: Candidate,
  issues: EntryIssue[],
  notes: string[],
  cells: Cell[],
): DraftEntry {
  const all = [...issues];
  const externalId = candidate.externalId?.trim() || null;
  if (externalId && externalId.length > EXTERNAL_ID_MAX_LENGTH) {
    all.push({
      field: 'externalId',
      message: `Use an id of at most ${EXTERNAL_ID_MAX_LENGTH} characters.`,
    });
  }
  if (all.length === 0) {
    const parsed = createTransactionRequestSchema.safeParse(candidate);
    if (parsed.success) {
      const { type, amountCents, description, category, date } = parsed.data;
      return {
        row,
        status: 'VALID',
        transaction: { type, amountCents, description, category, date, externalId },
        issues: [],
        notes,
        cells: null,
      };
    }
    for (const issue of parsed.error.issues) {
      all.push({ field: fieldOf[String(issue.path[0])] ?? null, message: issue.message });
    }
  }
  return {
    row,
    status: 'INVALID',
    transaction: null,
    issues: all,
    notes,
    cells: cells.map((cell) => cellText(cell)),
  };
}
