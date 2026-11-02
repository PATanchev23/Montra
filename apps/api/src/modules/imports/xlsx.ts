import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib';
import { excelSerialToDate } from './values';
import { FileReadError, type Cell } from './types';

/*
 * A deliberately small XLSX (Office Open XML) reader and writer, so imports
 * need no third-party spreadsheet library. It reads the first worksheet's
 * values: shared and inline strings, numbers, booleans, and numbers
 * formatted as dates. Formulas are read as their cached results. Limits on
 * entry sizes guard against zip bombs; XML is matched with fixed patterns,
 * never evaluated, so entity tricks cannot expand.
 */

/** Largest uncompressed part read from a workbook. */
const MAX_PART_BYTES = 64 * 1024 * 1024;
const MAX_COLUMNS = 500;

interface ZipEntry {
  method: number;
  flags: number;
  compressedSize: number;
  localOffset: number;
}

function readZipDirectory(zip: Buffer): Map<string, ZipEntry> {
  const minEnd = Math.max(0, zip.length - 22 - 0xffff);
  let end = -1;
  for (let i = zip.length - 22; i >= minEnd; i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new FileReadError('The file is not a valid Excel workbook.');

  const count = zip.readUInt16LE(end + 10);
  let offset = zip.readUInt32LE(end + 16);
  const entries = new Map<string, ZipEntry>();
  for (let i = 0; i < count; i++) {
    if (offset + 46 > zip.length || zip.readUInt32LE(offset) !== 0x02014b50) {
      throw new FileReadError('The workbook is damaged.');
    }
    const nameLength = zip.readUInt16LE(offset + 28);
    const name = zip.toString('utf8', offset + 46, offset + 46 + nameLength);
    entries.set(name, {
      flags: zip.readUInt16LE(offset + 8),
      method: zip.readUInt16LE(offset + 10),
      compressedSize: zip.readUInt32LE(offset + 20),
      localOffset: zip.readUInt32LE(offset + 42),
    });
    offset += 46 + nameLength + zip.readUInt16LE(offset + 30) + zip.readUInt16LE(offset + 32);
  }
  return entries;
}

function readZipEntry(zip: Buffer, entries: Map<string, ZipEntry>, name: string): string | null {
  const entry = entries.get(name);
  if (!entry) return null;
  if (entry.flags & 1) throw new FileReadError('The workbook is password-protected.');
  const header = entry.localOffset;
  if (header + 30 > zip.length || zip.readUInt32LE(header) !== 0x04034b50) {
    throw new FileReadError('The workbook is damaged.');
  }
  const start = header + 30 + zip.readUInt16LE(header + 26) + zip.readUInt16LE(header + 28);
  const data = zip.subarray(start, start + entry.compressedSize);
  if (data.length !== entry.compressedSize) throw new FileReadError('The workbook is damaged.');
  try {
    if (entry.method === 0) return data.toString('utf8');
    if (entry.method === 8) {
      return inflateRawSync(data, { maxOutputLength: MAX_PART_BYTES }).toString('utf8');
    }
  } catch {
    throw new FileReadError('The workbook is damaged or too large to read.');
  }
  throw new FileReadError('The workbook uses a compression method Montra cannot read.');
}

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

/** XML character references and OOXML's _xHHHH_ escapes; nothing else. */
function decodeXml(text: string): string {
  return text
    .replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (match, ref: string) => {
      if (ref[0] !== '#') return ENTITIES[ref.toLowerCase()] ?? match;
      const code =
        ref[1] === 'x' || ref[1] === 'X' ? parseInt(ref.slice(2), 16) : Number(ref.slice(1));
      return Number.isInteger(code) && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    })
    .replace(/_x([0-9A-Fa-f]{4})_/g, (_match, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
}

function attribute(tag: string, name: string): string | undefined {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])(.*?)\\1`).exec(tag);
  return match ? decodeXml(match[2]!) : undefined;
}

/** Elements named `tag` (any namespace prefix): their attributes and inner XML. */
function* elements(xml: string, tag: string): Generator<{ attrs: string; inner: string }> {
  const pattern = new RegExp(
    `<(?:[\\w.-]+:)?${tag}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</(?:[\\w.-]+:)?${tag}>)`,
    'g',
  );
  for (const match of xml.matchAll(pattern)) yield { attrs: match[1]!, inner: match[2] ?? '' };
}

/** The text of a string item: its runs, without phonetic guides. */
function richText(xml: string): string {
  const visible = xml.replace(/<(?:[\w.-]+:)?rPh\b[\s\S]*?<\/(?:[\w.-]+:)?rPh>/g, '');
  let text = '';
  for (const { inner } of elements(visible, 't')) text += decodeXml(inner);
  return text;
}

const BUILT_IN_DATE_FORMATS = new Set([
  14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51,
  52, 53, 54, 55, 56, 57, 58,
]);

/** Whether a number format shows a date: it has a day or year part once literals are removed. */
function isDateFormat(code: string): boolean {
  const bare = code.replace(/"[^"]*"|\\.|\[[^\]]*\]/g, '');
  return /[dy]/i.test(bare);
}

/** Per cell style index: whether numbers in that style are dates. */
function dateStyles(stylesXml: string | null): boolean[] {
  if (!stylesXml) return [];
  const custom = new Map<number, string>();
  for (const { attrs } of elements(stylesXml, 'numFmt')) {
    custom.set(Number(attribute(attrs, 'numFmtId')), attribute(attrs, 'formatCode') ?? '');
  }
  const cellXfs = elements(stylesXml, 'cellXfs').next().value?.inner ?? '';
  return [...elements(cellXfs, 'xf')].map(({ attrs }) => {
    const id = Number(attribute(attrs, 'numFmtId') ?? 0);
    return BUILT_IN_DATE_FORMATS.has(id) || isDateFormat(custom.get(id) ?? '');
  });
}

function columnIndex(reference: string | undefined): number | null {
  const letters = reference && /^([A-Z]+)/i.exec(reference)?.[1]?.toUpperCase();
  if (!letters) return null;
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
}

export interface SheetRow {
  row: number;
  cells: Cell[];
}

/** The first worksheet's non-empty rows. Stops with an error after `maxRows` rows. */
export function readXlsx(file: Buffer, maxRows: number): SheetRow[] {
  const entries = readZipDirectory(file);
  const workbook = readZipEntry(file, entries, 'xl/workbook.xml');
  if (!workbook) throw new FileReadError('The file is not a valid Excel workbook.');

  const firstSheet = elements(workbook, 'sheet').next().value;
  const relationId =
    firstSheet && /\b[\w.-]+:id\s*=\s*["']([^"']+)["']/.exec(firstSheet.attrs)?.[1];
  const rels = readZipEntry(file, entries, 'xl/_rels/workbook.xml.rels') ?? '';
  const target = [...elements(rels, 'Relationship')]
    .map(({ attrs }) => ({ id: attribute(attrs, 'Id'), target: attribute(attrs, 'Target') }))
    .find((rel) => rel.id === relationId)?.target;
  const sheetPath = target
    ? target.startsWith('/')
      ? target.slice(1)
      : `xl/${target.replace(/^\.\//, '')}`
    : 'xl/worksheets/sheet1.xml';
  const sheet = readZipEntry(file, entries, sheetPath);
  if (!sheet) throw new FileReadError('The workbook has no worksheet.');

  const date1904 = /<(?:[\w.-]+:)?workbookPr\b[^>]*\bdate1904\s*=\s*["'](?:1|true)["']/.test(
    workbook,
  );
  const sharedXml = readZipEntry(file, entries, 'xl/sharedStrings.xml');
  const shared = sharedXml
    ? [...elements(sharedXml, 'si')].map(({ inner }) => richText(inner))
    : [];
  const isDateStyle = dateStyles(readZipEntry(file, entries, 'xl/styles.xml'));

  const rows: SheetRow[] = [];
  let nextRow = 1;
  for (const { attrs, inner } of elements(sheet, 'row')) {
    const rowNumber = Number(attribute(attrs, 'r') ?? nextRow);
    nextRow = rowNumber + 1;
    const cells: Cell[] = [];
    let nextColumn = 0;
    for (const cell of elements(inner, 'c')) {
      const column = columnIndex(attribute(cell.attrs, 'r')) ?? nextColumn;
      nextColumn = column + 1;
      if (column >= MAX_COLUMNS)
        throw new FileReadError(`The sheet has more than ${MAX_COLUMNS} columns.`);
      const type = attribute(cell.attrs, 't') ?? 'n';
      const raw = /<(?:[\w.-]+:)?v\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?v>/.exec(cell.inner)?.[1];
      let value: Cell = '';
      if (type === 's') value = shared[Number(raw)] ?? '';
      else if (type === 'inlineStr') value = richText(cell.inner);
      else if (type === 'str' || type === 'e') value = decodeXml(raw ?? '');
      else if (type === 'b') value = raw === '1' ? 'TRUE' : 'FALSE';
      else if (type === 'd') value = decodeXml(raw ?? '').slice(0, 10);
      else if (raw !== undefined && raw.trim() !== '') {
        const number = Number(raw);
        const style = Number(attribute(cell.attrs, 's') ?? 0);
        if (!Number.isFinite(number)) value = raw;
        else if (isDateStyle[style]) value = excelSerialToDate(number, date1904) ?? String(number);
        // Excel keeps 15 significant digits; this undoes binary noise like 0.30000000000000004.
        else value = Number(number.toPrecision(15));
      }
      cells[column] = value;
    }
    for (let i = 0; i < cells.length; i++) cells[i] ??= '';
    if (cells.every((cell) => cell === '' || (typeof cell === 'string' && cell.trim() === '')))
      continue;
    rows.push({ row: rowNumber, cells });
    if (rows.length > maxRows) break;
  }
  return rows;
}

// ── Writing ─────────────────────────────────────────────────────────────

export type WriteCell = string | number | { date: string } | null;

const escapeXml = (text: string) =>
  text.replace(/[<>&"]/g, (char) => `&${{ '<': 'lt', '>': 'gt', '&': 'amp', '"': 'quot' }[char]};`);

function columnName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }
  return name;
}

function zip(files: [string, string][], compress: boolean): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of files) {
    const data = Buffer.from(content, 'utf8');
    const stored = compress ? deflateRawSync(data) : data;
    const nameBytes = Buffer.from(name, 'utf8');
    const checksum = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(compress ? 8 : 0, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(stored.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(compress ? 8 : 0, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(stored.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);

    locals.push(local, nameBytes, stored);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + stored.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const DATE_SERIAL_EPOCH = Date.UTC(1899, 11, 30);

/**
 * A one-sheet workbook. Strings go in the shared string table (as Excel
 * writes them) or inline; `{ date }` cells are stored as date-formatted
 * serial numbers.
 */
export function writeXlsx(
  rows: WriteCell[][],
  { sheetName = 'Transactions', sharedStrings = true, compress = true } = {},
): Buffer {
  const strings: string[] = [];
  const stringIndex = new Map<string, number>();
  const sheetRows = rows.map((cells, r) => {
    const xmlCells = cells.map((cell, c) => {
      const ref = `${columnName(c)}${r + 1}`;
      if (cell === null || cell === '') return '';
      if (typeof cell === 'number') return `<c r="${ref}"><v>${cell}</v></c>`;
      if (typeof cell === 'object') {
        const serial = (Date.parse(`${cell.date}T00:00:00Z`) - DATE_SERIAL_EPOCH) / 86_400_000;
        return `<c r="${ref}" s="1"><v>${serial}</v></c>`;
      }
      if (!sharedStrings) {
        return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell)}</t></is></c>`;
      }
      let index = stringIndex.get(cell);
      if (index === undefined) {
        index = strings.push(cell) - 1;
        stringIndex.set(cell, index);
      }
      return `<c r="${ref}" t="s"><v>${index}</v></c>`;
    });
    return `<row r="${r + 1}">${xmlCells.join('')}</row>`;
  });

  const ns = 'http://schemas.openxmlformats.org';
  const files: [string, string][] = [
    [
      '[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="${ns}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sharedStrings ? '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' : ''}</Types>`,
    ],
    [
      '_rels/.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${ns}/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      'xl/workbook.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${ns}/spreadsheetml/2006/main" xmlns:r="${ns}/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ],
    [
      'xl/_rels/workbook.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${ns}/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${ns}/officeDocument/2006/relationships/styles" Target="styles.xml"/>${sharedStrings ? `<Relationship Id="rId3" Type="${ns}/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>` : ''}</Relationships>`,
    ],
    [
      'xl/styles.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${ns}/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`,
    ],
    [
      'xl/worksheets/sheet1.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${ns}/spreadsheetml/2006/main"><sheetData>${sheetRows.join('')}</sheetData></worksheet>`,
    ],
  ];
  if (sharedStrings) {
    files.push([
      'xl/sharedStrings.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="${ns}/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${strings.map((text) => `<si><t xml:space="preserve">${escapeXml(text)}</t></si>`).join('')}</sst>`,
    ]);
  }
  return zip(files, compress);
}
