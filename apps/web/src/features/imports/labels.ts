import type {
  DateFormat,
  DecimalSeparator,
  ImportBatch,
  ImportEntryStatus,
  ImportField,
  ImportRequirement,
  ImportStatus,
} from '@montra/shared';
import type { Tone } from '../../components/ui/Badge';

export const fieldLabels: Record<ImportField, string> = {
  date: 'Date',
  description: 'Description',
  amount: 'Amount',
  type: 'Type',
  category: 'Category',
  currency: 'Currency',
  externalId: 'External ID',
};

/** What each field is for, shown beside its column picker. */
export function fieldHint(field: ImportField, typeRequired: boolean): string {
  switch (field) {
    case 'date':
      return 'When the money moved.';
    case 'description':
      return 'What the payment was for.';
    case 'amount':
      return 'The value of each record.';
    case 'type':
      return typeRequired
        ? 'Says Income or Expense.'
        : 'Optional. Without it, negative amounts are expenses and others income.';
    case 'category':
      return 'Optional when a default category is set below.';
    case 'currency':
      return 'Optional. Records in another currency are refused, never converted.';
    case 'externalId':
      return 'Optional. A reference that stops the same record being imported twice.';
  }
}

export const requirementMessages: Record<ImportRequirement, string> = {
  date: 'Choose the column with the dates.',
  description: 'Choose the column with the descriptions.',
  amount: 'Choose the column with the amounts.',
  type: 'Choose the column that says Income or Expense.',
  category: 'Choose a category column, or set a default category.',
  currency: 'Choose the currency column.',
  externalId: 'Choose the external ID column.',
  dateFormat: 'Choose how dates are written: some could be read either way.',
};

export const dateFormatOptions: { value: DateFormat | 'auto'; label: string }[] = [
  { value: 'auto', label: 'Detect from the file' },
  { value: 'YMD', label: 'Year first · 2026-10-05' },
  { value: 'DMY', label: 'Day first · 05.10.2026' },
  { value: 'MDY', label: 'Month first · 10/05/2026' },
];

export const decimalOptions: { value: DecimalSeparator | 'auto'; label: string }[] = [
  { value: 'auto', label: 'Detect from the file' },
  { value: '.', label: 'Point · 1250.50' },
  { value: ',', label: 'Comma · 1250,50' },
];

export const statusLabels: Record<ImportStatus, { label: string; tone: Tone }> = {
  AWAITING_MAPPING: { label: 'Needs mapping', tone: 'warning' },
  READY: { label: 'Ready to review', tone: 'accent' },
  COMPLETED: { label: 'Imported', tone: 'positive' },
  FAILED: { label: 'Failed', tone: 'negative' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
  EXPIRED: { label: 'Expired', tone: 'neutral' },
};

export const entryStatusLabels: Record<ImportEntryStatus, { label: string; tone: Tone }> = {
  VALID: { label: 'Valid', tone: 'positive' },
  INVALID: { label: 'Invalid', tone: 'negative' },
  DUPLICATE: { label: 'Duplicate', tone: 'neutral' },
  POSSIBLE_DUPLICATE: { label: 'Possible duplicate', tone: 'warning' },
};

export const isPending = (status: ImportStatus) =>
  status === 'AWAITING_MAPPING' || status === 'READY';

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count.toLocaleString('en')} ${count === 1 ? one : many}`;

/** A finished import's outcome in one line, e.g. "24 imported · 2 skipped · 1 invalid". */
export function outcomeLine(batch: ImportBatch): string {
  if (isPending(batch.status)) {
    return batch.status === 'READY' ? plural(batch.totalRecords, 'record') : 'Columns to map';
  }
  if (batch.status === 'CANCELLED' || batch.status === 'EXPIRED') return 'Nothing imported';
  return [
    `${batch.importedRecords.toLocaleString('en')} imported`,
    batch.skippedRecords > 0 && `${batch.skippedRecords.toLocaleString('en')} skipped`,
    batch.failedRecords > 0 && `${batch.failedRecords.toLocaleString('en')} invalid`,
  ]
    .filter(Boolean)
    .join(' · ');
}

export { plural };
