import { FileReadError } from './types';

/**
 * Bytes to text. UTF-8 (with or without BOM) and UTF-16 with a BOM are read
 * as such; anything that is not valid UTF-8 is read as Windows-1252, which
 * is what Excel on Windows writes for "CSV".
 */
export function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

const DELIMITERS = [',', ';', '\t', '|'] as const;

/** Fields per line for the first lines, ignoring delimiters inside quotes. */
function fieldCounts(lines: string[], delimiter: string): number[] {
  return lines.map((line) => {
    let count = 1;
    let quoted = false;
    for (const char of line) {
      if (char === '"') quoted = !quoted;
      else if (char === delimiter && !quoted) count++;
    }
    return count;
  });
}

/**
 * The delimiter that splits the header into several columns and the lines
 * below into the same number. Semicolons are common where the comma is the
 * decimal separator.
 */
export function detectDelimiter(text: string): string {
  const lines = text
    .split(/\r\n|\n|\r/)
    .filter((line) => line.trim() !== '')
    .slice(0, 20);
  let best: { delimiter: string; score: number } = { delimiter: ',', score: -1 };
  for (const delimiter of DELIMITERS) {
    const counts = fieldCounts(lines, delimiter);
    const header = counts[0] ?? 1;
    if (header < 2) continue;
    const consistent = counts.filter((count) => count === header).length;
    const score = consistent * 1000 + header;
    if (score > best.score) best = { delimiter, score };
  }
  return best.delimiter;
}

export interface CsvRecord {
  /** 1-based record number, as a spreadsheet would number the row. */
  row: number;
  cells: string[];
}

/**
 * RFC 4180 CSV: quoted fields may contain delimiters, doubled quotes and line
 * breaks. A quote inside an unquoted field is kept as a character. Honors
 * Excel's "sep=;" first line.
 */
export function parseCsv(input: string): CsvRecord[] {
  let text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  let delimiter: string;
  const directive = /^sep=(.)\r?\n/i.exec(text);
  if (directive) {
    delimiter = directive[1]!;
    text = text.slice(directive[0].length);
  } else {
    delimiter = detectDelimiter(text);
  }

  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let field = '';
  let quoted = false;
  let quoteStartRow = 0;
  let row = 1;

  const endField = () => {
    cells.push(field);
    field = '';
  };
  const endRecord = () => {
    endField();
    records.push({ row, cells });
    cells = [];
    row++;
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"' && field === '') {
      quoted = true;
      quoteStartRow = row;
    } else if (char === delimiter) {
      endField();
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      endRecord();
    } else {
      field += char;
    }
  }
  if (quoted) {
    throw new FileReadError(`A quoted value starting on row ${quoteStartRow} is never closed.`);
  }
  if (field !== '' || cells.length > 0) endRecord();

  return records.filter((record) => record.cells.some((cell) => cell.trim() !== ''));
}
