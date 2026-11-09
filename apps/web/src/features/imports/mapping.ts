import {
  columnMappingSchema,
  IMPORT_FIELDS,
  type ColumnMapping,
  type DateFormat,
  type DecimalSeparator,
  type ImportField,
} from '@montra/shared';

/** A column mapping as edited: every setting present, "auto" for detect. */
export interface MappingDraft {
  columns: Partial<Record<ImportField, number>>;
  dateFormat: DateFormat | 'auto';
  decimalSeparator: DecimalSeparator | 'auto';
  defaultCategory: string;
}

export function draftFrom(mapping: ColumnMapping | null): MappingDraft {
  const columns: MappingDraft['columns'] = {};
  for (const field of IMPORT_FIELDS) {
    const index = mapping?.columns[field];
    if (index !== undefined) columns[field] = index;
  }
  return {
    columns,
    dateFormat: mapping?.dateFormat ?? 'auto',
    decimalSeparator: mapping?.decimalSeparator ?? 'auto',
    defaultCategory: mapping?.defaultCategory ?? '',
  };
}

/** The mapping to send; settings left on "detect" are left out so the API detects them. */
export function mappingFrom(draft: MappingDraft): ColumnMapping {
  const defaultCategory = draft.defaultCategory.trim();
  // In field order, so equal mappings compare equal however they were edited.
  const columns: ColumnMapping['columns'] = {};
  for (const field of IMPORT_FIELDS) {
    if (draft.columns[field] !== undefined) columns[field] = draft.columns[field];
  }
  return {
    columns,
    ...(draft.dateFormat !== 'auto' && { dateFormat: draft.dateFormat }),
    ...(draft.decimalSeparator !== 'auto' && { decimalSeparator: draft.decimalSeparator }),
    ...(defaultCategory && { defaultCategory }),
  };
}

/** Whether a draft would change the mapping the API is using. */
export function isDirty(draft: MappingDraft, saved: ColumnMapping | null): boolean {
  return JSON.stringify(mappingFrom(draft)) !== JSON.stringify(mappingFrom(draftFrom(saved)));
}

/** Why the draft cannot be sent, by the same rules the API applies; null when it can. */
export function draftProblem(draft: MappingDraft): string | null {
  const parsed = columnMappingSchema.safeParse(mappingFrom(draft));
  if (parsed.success) return null;
  const issue = parsed.error.issues[0]!;
  return issue.path[0] === 'defaultCategory' ? `Default category: ${issue.message}` : issue.message;
}

/** Maps `field` to `index` (or nothing), freeing any other field that used that column. */
export function assignColumn(
  draft: MappingDraft,
  field: ImportField,
  index: number | undefined,
): MappingDraft {
  const columns = { ...draft.columns };
  delete columns[field];
  if (index !== undefined) {
    for (const other of IMPORT_FIELDS) {
      if (columns[other] === index) delete columns[other];
    }
    columns[field] = index;
  }
  return { ...draft, columns };
}
const SAMPLE_LENGTH = 22;

const clip = (text: string) =>
  text.length > SAMPLE_LENGTH ? `${text.slice(0, SAMPLE_LENGTH - 1)}…` : text;

/** "Сума — e.g. 1 250,00": the header with its first non-empty value, to recognise columns by. */
export function columnOptions(columns: string[], sampleRows: string[][]) {
  return columns.map((header, index) => {
    const sample = sampleRows.map((row) => row[index] ?? '').find((value) => value !== '');
    const name = header.trim() || `Column ${index + 1}`;
    return { value: String(index), label: sample ? `${name} — e.g. ${clip(sample)}` : name };
  });
}
