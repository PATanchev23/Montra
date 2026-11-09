import type { ImportSource, TransactionType } from '@montra/shared';
import type { EntryType } from '../../demo/types';

/** The direction as the shared finance components name it. */
export const entryType = (type: TransactionType): EntryType =>
  type === 'INCOME' ? 'income' : 'expense';

export const typeLabel = (type: TransactionType) => (type === 'INCOME' ? 'Income' : 'Expense');

export const sourceLabels: Record<ImportSource, string> = {
  MONTRA_TEMPLATE: 'Montra template',
  GENERIC_CSV: 'CSV file',
  GENERIC_EXCEL: 'Excel file',
};

export function sourceLabel(source: ImportSource | null): string {
  return source ? `Imported · ${sourceLabels[source]}` : 'Entered by hand';
}
