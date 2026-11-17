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
import { messagesFor } from '../../i18n';
import { count } from '../../lib/format';
import { importMessages } from './messages';

/*
 * Labels for the import flow, in the interface language. They are read when
 * called, so a language switch (which re-mounts the page) picks them up.
 */

const m = () => messagesFor(importMessages);

export const fieldLabel = (field: ImportField) => m().fields[field];

/** What each field is for, shown beside its column picker. */
export function fieldHint(field: ImportField, typeRequired: boolean): string {
  const hints = m().fieldHints;
  if (field === 'type') return typeRequired ? hints.typeRequired : hints.typeOptional;
  return hints[field];
}

export const requirementMessage = (requirement: ImportRequirement) => m().requirements[requirement];

const DATE_FORMATS: (DateFormat | 'auto')[] = ['auto', 'YMD', 'DMY', 'MDY'];
const DECIMALS: (DecimalSeparator | 'auto')[] = ['auto', '.', ','];

export const dateFormatOptions = () =>
  DATE_FORMATS.map((value) => ({ value, label: m().dateFormats[value] }));

export const decimalOptions = () =>
  DECIMALS.map((value) => ({ value, label: m().decimals[value] }));

const statusTones: Record<ImportStatus, Tone> = {
  AWAITING_MAPPING: 'warning',
  READY: 'accent',
  COMPLETED: 'positive',
  FAILED: 'negative',
  CANCELLED: 'neutral',
  EXPIRED: 'neutral',
};

export const statusLabel = (status: ImportStatus) => ({
  label: m().status[status],
  tone: statusTones[status],
});

const entryTones: Record<ImportEntryStatus, Tone> = {
  VALID: 'positive',
  INVALID: 'negative',
  DUPLICATE: 'neutral',
  POSSIBLE_DUPLICATE: 'warning',
};

export const entryStatusLabel = (status: ImportEntryStatus) => ({
  label: m().entryStatus[status],
  tone: entryTones[status],
});

export const isPending = (status: ImportStatus) =>
  status === 'AWAITING_MAPPING' || status === 'READY';

/** "1 record", "24 records" (Bulgarian "24 записа"). */
export const records = (n: number) => m().records(count(n), n);

/** "1 transaction", "24 transactions". */
export const transactions = (n: number) => m().transactions(count(n), n);

/** A finished import's outcome in one line, e.g. "24 imported · 2 skipped · 1 invalid". */
export function outcomeLine(batch: ImportBatch): string {
  const o = m().outcome;
  if (isPending(batch.status)) {
    return batch.status === 'READY' ? records(batch.totalRecords) : o.columnsToMap;
  }
  if (batch.status === 'CANCELLED' || batch.status === 'EXPIRED') return o.nothing;
  return [
    o.imported(count(batch.importedRecords)),
    batch.skippedRecords > 0 && o.skipped(count(batch.skippedRecords)),
    batch.failedRecords > 0 && o.invalid(count(batch.failedRecords)),
  ]
    .filter(Boolean)
    .join(' · ');
}
