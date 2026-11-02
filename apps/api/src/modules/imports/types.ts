import type { ImportField, ImportedTransaction } from '@montra/shared';

/**
 * A cell as read from a file. Text everywhere, except XLSX numeric cells,
 * which keep their number so "1234.5" never depends on a decimal setting.
 * XLSX date cells arrive as ISO dates (yyyy-mm-dd).
 */
export type Cell = string | number;

export interface TableRow {
  /** The row number a spreadsheet would show; the header is usually row 1. */
  row: number;
  cells: Cell[];
}

/** A file's first sheet: the header row and every non-empty data row. */
export interface ParsedTable {
  columns: string[];
  rows: TableRow[];
}

export interface EntryIssue {
  field: ImportField | null;
  message: string;
}

/** A record read from the file, before duplicate detection. */
export interface DraftEntry {
  row: number;
  status: 'VALID' | 'INVALID';
  transaction: ImportedTransaction | null;
  issues: EntryIssue[];
  notes: string[];
  cells: string[] | null;
}

/** Read failures that make the whole file unusable. */
export class FileReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileReadError';
  }
}

export function cellText(cell: Cell | undefined): string {
  if (cell === undefined) return '';
  return typeof cell === 'number' ? String(cell) : cell.trim();
}
