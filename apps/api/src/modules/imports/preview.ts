import type {
  ColumnMapping,
  ImportEntry,
  ImportRequirement,
  ImportSource,
  ImportSummary,
} from '@montra/shared';
import { mappedEntries, mappingNotices, resolveMapping } from './mapping';
import type { DraftEntry, ParsedTable } from './types';

export interface Preview {
  /** The mapping with detected settings filled in. */
  mapping: ColumnMapping;
  missing: ImportRequirement[];
  /** Null until the mapping is complete. */
  drafts: DraftEntry[] | null;
  notices: string[];
}

/**
 * Reads every record from a parsed file. Deterministic for the same table
 * and mapping, so entry indexes chosen in a preview still mean the same
 * records at confirmation.
 */
export function buildPreview(
  source: ImportSource,
  table: ParsedTable,
  mapping: ColumnMapping | null,
  currency: string,
): Preview {
  // The template always has a type column; generic files may use the amount's sign instead.
  const requireType = source === 'MONTRA_TEMPLATE';
  const resolved = resolveMapping(table, mapping ?? { columns: {} }, { requireType });
  return {
    mapping: resolved.mapping,
    missing: resolved.missing,
    drafts:
      resolved.missing.length > 0
        ? null
        : mappedEntries(table, resolved.mapping, currency, { requireType }),
    notices: mappingNotices(table, resolved.mapping, { requireType }),
  };
}

export function summarize(entries: ImportEntry[]): ImportSummary {
  const count = (status: ImportEntry['status']) =>
    entries.filter((entry) => entry.status === status).length;
  return {
    total: entries.length,
    valid: count('VALID'),
    invalid: count('INVALID'),
    duplicates: count('DUPLICATE'),
    possibleDuplicates: count('POSSIBLE_DUPLICATE'),
  };
}
