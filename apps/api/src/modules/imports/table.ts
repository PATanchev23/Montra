import { IMPORT_MAX_ROWS, type ImportFileFormat } from '@montra/shared';
import { decodeText, parseCsv } from './csv';
import { cellText, FileReadError, type ParsedTable, type TableRow } from './types';
import { readXlsx } from './xlsx';

export type DetectedFormat =
  { ok: true; format: ImportFileFormat } | { ok: false; message: string };

/** What the file is, from its first bytes rather than its name or declared type. */
export function detectFormat(file: Buffer): DetectedFormat {
  if (file.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
    return { ok: true, format: 'XLSX' };
  }
  if (file.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]))) {
    return {
      ok: false,
      message: 'This is an older Excel (.xls) file. Save it as .xlsx or .csv and upload it again.',
    };
  }
  if (file.subarray(0, 5).toString('latin1') === '%PDF-') {
    return { ok: false, message: 'PDF files cannot be imported. Upload a .csv or .xlsx file.' };
  }
  // Text files have no NUL bytes, except UTF-16, which starts with a byte order mark.
  const utf16 = (file[0] === 0xff && file[1] === 0xfe) || (file[0] === 0xfe && file[1] === 0xff);
  if (!utf16 && file.subarray(0, 8192).includes(0)) {
    return { ok: false, message: 'This is not a CSV or Excel (.xlsx) file.' };
  }
  return { ok: true, format: 'CSV' };
}

/** Parses the file's first sheet into a header and data rows. */
export function readTable(file: Buffer, format: ImportFileFormat): ParsedTable {
  const records =
    format === 'XLSX' ? readXlsx(file, IMPORT_MAX_ROWS + 1) : parseCsv(decodeText(file));
  const [header, ...data] = records;
  if (!header) throw new FileReadError('The file is empty.');
  if (data.length === 0) throw new FileReadError('The file has a header row but no data rows.');

  const columns = header.cells.map((cell) => cellText(cell));
  if (columns.every((column) => column === '')) {
    throw new FileReadError('The first row must hold the column names.');
  }
  const rows: TableRow[] = data.map(({ row, cells }) => ({
    row,
    cells: cells.map((cell) => (typeof cell === 'string' ? cell.trim() : cell)),
  }));
  return { columns, rows };
}
