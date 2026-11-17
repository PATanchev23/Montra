import type { ImportSource, TransactionType } from '@montra/shared';
import type { EntryType } from '../../demo/types';
import { messagesFor } from '../../i18n';
import { transactionMessages } from './messages';

/** The direction as the shared finance components name it. */
export const entryType = (type: TransactionType): EntryType =>
  type === 'INCOME' ? 'income' : 'expense';

/** The type as the Montra template writes it: always English, so an export imports again. */
export const templateTypeLabel = (type: TransactionType) =>
  type === 'INCOME' ? 'Income' : 'Expense';

/** The type in the interface language. */
export const typeLabel = (type: TransactionType) => messagesFor(transactionMessages).type[type];

/** Where an import came from, in the interface language. */
export const sourceName = (source: ImportSource) =>
  messagesFor(transactionMessages).sources[source];

export function sourceLabel(source: ImportSource | null): string {
  const m = messagesFor(transactionMessages);
  return source ? m.imported(m.sources[source]) : m.byHand;
}
