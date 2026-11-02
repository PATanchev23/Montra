import {
  MONTRA_TEMPLATE_COLUMNS,
  SUPPORTED_CURRENCIES,
  type ColumnMapping,
  type ImportField,
  type ImportRequirement,
  type TransactionType,
} from '@montra/shared';
import { finishEntry, type Candidate } from './entries';
import { cellText, type DraftEntry, type EntryIssue, type ParsedTable } from './types';
import {
  detectDateFormat,
  detectDecimalSeparator,
  normalizeText,
  parseAmount,
  parseDate,
  parseType,
} from './values';

/** Header names (normalised, see headerKey) that suggest a field, in English and Bulgarian. */
const ALIASES: Record<ImportField, string[]> = {
  date: [
    'date',
    'transaction date',
    'booking date',
    'posting date',
    'posted',
    'posted date',
    'value date',
    'payment date',
    'дата',
    'дата на плащане',
    'дата на транзакция',
    'дата на операция',
    'дата на операцията',
    'вальор',
    'дата на вальор',
  ],
  description: [
    'description',
    'details',
    'detail',
    'memo',
    'narrative',
    'payee',
    'merchant',
    'transaction details',
    'transaction description',
    'payment details',
    'particulars',
    'reason',
    'описание',
    'описание на операцията',
    'основание',
    'основание за плащане',
    'детайли',
  ],
  amount: [
    'amount',
    'value',
    'sum',
    'transaction amount',
    'сума',
    'сума на операцията',
    'стойност',
  ],
  type: [
    'type',
    'transaction type',
    'direction',
    'debit credit',
    'dr cr',
    'тип',
    'вид',
    'дебит кредит',
    'д к',
  ],
  category: ['category', 'категория'],
  currency: ['currency', 'ccy', 'currency code', 'валута'],
  externalId: [
    'id',
    'transaction id',
    'external id',
    'reference',
    'reference number',
    'reference no',
    'transaction reference',
    'ref',
    'референция',
    'референтен номер',
    'номер на операция',
    'номер на транзакция',
  ],
};

const CURRENCY_WORDS = new Set([
  ...SUPPORTED_CURRENCIES.map((code) => code.toLowerCase()),
  'bgn',
  'лв',
  'евро',
]);

/**
 * A header as matched against field names: case, punctuation, anything in
 * brackets and a trailing currency are ignored, so "Amount (EUR)", "Сума, лв."
 * and "AMOUNT" all read as the amount.
 */
function headerKey(header: string): string {
  const words = normalizeText(header.replace(/\([^)]*\)|\[[^\]]*\]/g, ' '))
    .split(' ')
    .filter(Boolean);
  while (words.length > 1 && CURRENCY_WORDS.has(words.at(-1)!)) words.pop();
  return words.join(' ');
}

/** A first guess at a generic file's mapping, from its header names. */
export function suggestMapping(columns: string[]): ColumnMapping {
  const names = columns.map(headerKey);
  const used = new Set<number>();
  const mapped: ColumnMapping['columns'] = {};
  for (const field of Object.keys(ALIASES) as ImportField[]) {
    const index = names.findIndex((name, i) => !used.has(i) && ALIASES[field].includes(name));
    if (index >= 0) {
      mapped[field] = index;
      used.add(index);
    }
  }
  return { columns: mapped };
}

/** The template's mapping, or the required template columns the file lacks. */
export function templateMapping(columns: string[]): { mapping: ColumnMapping; absent: string[] } {
  const names = columns.map(headerKey);
  const mapped: ColumnMapping['columns'] = {};
  const absent: string[] = [];
  for (const { field, header, required } of MONTRA_TEMPLATE_COLUMNS) {
    const index = names.indexOf(headerKey(header));
    if (index >= 0) mapped[field] = index;
    else if (required) absent.push(header);
  }
  return { mapping: { columns: mapped }, absent };
}

export interface Resolution {
  /** The mapping with detected settings filled in. */
  mapping: ColumnMapping;
  missing: ImportRequirement[];
}

/**
 * Completes a mapping with the date format and decimal separator its values
 * show, and lists what is still needed. The template always has a type
 * column; generic files may instead use the amount's sign.
 */
export function resolveMapping(
  table: ParsedTable,
  mapping: ColumnMapping,
  { requireType }: { requireType: boolean },
): Resolution {
  const { columns } = mapping;
  const missing: ImportRequirement[] = [];
  for (const field of ['date', 'description', 'amount'] as const) {
    if (columns[field] === undefined) missing.push(field);
  }
  if (requireType && columns.type === undefined) missing.push('type');
  if (columns.category === undefined && !mapping.defaultCategory) missing.push('category');

  const values = (index: number | undefined) =>
    index === undefined ? [] : table.rows.map((row) => row.cells[index]);
  let dateFormat = mapping.dateFormat;
  if (!dateFormat && columns.date !== undefined) {
    dateFormat = detectDateFormat(values(columns.date)) ?? undefined;
    if (!dateFormat) missing.push('dateFormat');
  }
  const decimalSeparator =
    mapping.decimalSeparator ??
    (columns.amount === undefined ? undefined : detectDecimalSeparator(values(columns.amount)));

  return {
    mapping: {
      ...mapping,
      ...(dateFormat && { dateFormat }),
      ...(decimalSeparator && { decimalSeparator }),
    },
    missing,
  };
}

/** One record per row, read through a complete mapping. */
export function mappedEntries(
  table: ParsedTable,
  mapping: ColumnMapping,
  currency: string,
  { requireType }: { requireType: boolean },
): DraftEntry[] {
  const { columns, dateFormat = 'YMD', decimalSeparator = '.', defaultCategory } = mapping;
  const width = table.columns.length;

  return table.rows.map(({ row, cells }) => {
    const issues: EntryIssue[] = [];
    const notes: string[] = [];
    const candidate: Candidate = {};
    const read = (index: number | undefined) => (index === undefined ? '' : cellText(cells[index]));

    if (cells.slice(width).some((cell) => cellText(cell) !== '')) {
      issues.push({
        field: null,
        message:
          'This row has more values than the header has columns. Check for an unquoted separator.',
      });
    }

    const date = parseDate(cells[columns.date!], dateFormat);
    if (date.ok) candidate.date = date.value;
    else issues.push({ field: 'date', message: date.message });

    const description = read(columns.description);
    if (description) candidate.description = description;
    else issues.push({ field: 'description', message: 'The description is missing.' });

    const category = read(columns.category) || defaultCategory;
    if (category) candidate.category = category;
    else issues.push({ field: 'category', message: 'The category is missing.' });

    const amount = parseAmount(cells[columns.amount!], decimalSeparator);
    const rowCurrency =
      read(columns.currency).toUpperCase() || (amount.ok ? amount.value.currency : null);
    if (rowCurrency && rowCurrency !== currency) {
      issues.push({
        field: 'currency',
        message: `Amounts in ${rowCurrency} cannot be imported: this business records amounts in ${currency}.`,
      });
    }

    let type: TransactionType | null = null;
    const typeText = read(columns.type);
    if (columns.type !== undefined && typeText !== '') {
      type = parseType(typeText);
      if (!type) {
        issues.push({
          field: 'type',
          message: `“${typeText}” is not a type Montra knows. Use Income or Expense.`,
        });
      }
    } else if (requireType) {
      issues.push({ field: 'type', message: 'The type is missing. Use Income or Expense.' });
    }

    if (!amount.ok) {
      issues.push({ field: 'amount', message: amount.message });
    } else if (amount.value.cents === 0) {
      issues.push({ field: 'amount', message: 'The amount is zero.' });
    } else if (type === 'INCOME' && amount.value.cents < 0) {
      issues.push({ field: 'amount', message: 'The amount is negative, but the type is income.' });
    } else {
      candidate.amountCents = Math.abs(amount.value.cents);
      if (type) candidate.type = type;
      else if (typeText === '' && !requireType) {
        candidate.type = amount.value.cents < 0 ? 'EXPENSE' : 'INCOME';
        if (columns.type !== undefined) notes.push('No type given; read from the amount’s sign.');
      }
    }

    candidate.externalId = read(columns.externalId) || null;
    return finishEntry(row, candidate, issues, notes, cells);
  });
}

/**
 * How a mapping reads the file, in words the owner can check before
 * confirming: the date order and decimal separator in use, how income and
 * expenses are told apart, the default category, and columns left out.
 */
export function mappingNotices(
  table: ParsedTable,
  mapping: ColumnMapping,
  { requireType }: { requireType: boolean },
): string[] {
  const { columns, dateFormat, decimalSeparator, defaultCategory } = mapping;
  const notices: string[] = [];
  if (dateFormat === 'DMY') notices.push('Dates are read day first: 05.10.2026 is 5 October 2026.');
  if (dateFormat === 'MDY')
    notices.push('Dates are read month first: 10/05/2026 is 5 October 2026.');
  if (decimalSeparator === ',') {
    notices.push('Amounts use a comma for decimals: 1.250,50 means 1250.50.');
  }
  if (!requireType && columns.type === undefined && columns.amount !== undefined) {
    notices.push(
      'There is no type column: negative amounts are imported as expenses, others as income.',
    );
  }
  if (defaultCategory) {
    notices.push(
      columns.category === undefined
        ? `There is no category column: every record is filed under “${defaultCategory}”.`
        : `Records without a category are filed under “${defaultCategory}”.`,
    );
  }
  const mapped = new Set(Object.values(columns));
  const ignored = table.columns.filter(
    (name, index) =>
      name !== '' &&
      !mapped.has(index) &&
      table.rows.some((row) => cellText(row.cells[index]) !== ''),
  );
  if (ignored.length > 0) notices.push(`Not imported: ${ignored.join(', ')}.`);
  return notices;
}
