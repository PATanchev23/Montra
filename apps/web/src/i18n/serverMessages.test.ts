import { afterEach, describe, expect, it } from 'vitest';
import { useUiStore } from '../stores/ui';
import { bulgarianFor, localizeMessage } from './serverMessages';

afterEach(() => useUiStore.setState({ language: 'en' }));

/*
 * Every message the API and the shared schemas can show a person, with sample
 * values where the message carries one. A message added on the server should
 * be added here and to serverMessages.ts together.
 */
const SERVER_MESSAGES = [
  // apps/api: auth and access
  'Incorrect email or password.',
  'An account with this email already exists.',
  'Your session has ended. Sign in again.',
  'Sign in to continue.',
  'Requests from this origin are not allowed.',
  'Incorrect password.',
  'Demo accounts cannot be deleted.',
  'Business not found.',
  'Only the business owner can make changes.',
  'The request is invalid.',
  'Something went wrong on our side.',
  'Too many attempts. Try again in 1 minute.',
  'Too many attempts. Try again in 15 minutes.',
  // apps/api: billing
  'Billing is not set up yet.',
  'Only business owners can choose a paid plan.',
  'You already have a subscription. Change or cancel it in Manage billing.',
  'There is no billing to manage yet.',
  'This plan is not available to buy yet.',
  'The payment provider could not be reached. Try again in a moment.',
  // apps/web: the API client
  'Could not reach the Montra API.',
  'The API returned an unexpected response.',
  'Could not restore your session.',
  'Request failed with status 502.',
  // packages/shared: validation
  'Use a shorter email address.',
  'Enter a valid email address.',
  'Use at least 8 characters.',
  'Use at most 128 characters.',
  'Enter your name.',
  'Enter your password.',
  'Enter the business name.',
  'Choose a supported currency.',
  'Choose a valid time zone.',
  'Choose a month.',
  'Enter a whole amount in cents.',
  'The threshold cannot be negative.',
  'The threshold is too large.',
  'The balance is too large.',
  'Choose today or an earlier date.',
  'Choose income or expense.',
  'Enter a date.',
  'Enter a real date as YYYY-MM-DD.',
  'Enter a date between 1900 and 2199.',
  'Enter the amount in whole cents.',
  'The amount must be greater than zero.',
  'The amount is too large.',
  'Enter a description.',
  'Enter a category.',
  'Change at least one field.',
  'Map each column to one field at most.',
  'A custom period needs both `from` and `to`.',
  '`from` must not be after `to`.',
  '`from` and `to` apply only to a custom period.',
  'Choose at most 366 days.',
  // apps/web: form schemas
  'Enter an amount.',
  'Enter the amount without a sign; choose income or expense instead.',
  'Enter an amount such as 89.99.',
  'Enter an amount such as 2500 or 2500.50.',
  'Use at most two decimal places.',
  // apps/api: onboarding and transactions
  'Your business is already set up. Onboarding cannot be repeated.',
  'Some required business details are still missing.',
  'Your answers changed while finishing setup. Review them and try again.',
  'Transaction not found.',
  'This business records amounts in EUR. Convert the amount before adding it.',
  // apps/api: imports, the file
  'Import not found.',
  'The file is larger than 4 MB.',
  'Send the file itself as the request body, not as a form or JSON.',
  'Upload a .csv or .xlsx file.',
  'The file is empty.',
  'This is an Excel workbook. Import it as an Excel file.',
  'This is a CSV file. Import it as a CSV file.',
  'The file has more than 5000 rows. Split it into smaller files.',
  'This is not the Montra template. Missing columns: Date, Amount.',
  'There are already 3 imports waiting for review. Confirm or cancel one first.',
  'This import is completed and can no longer change.',
  'This import is expired and can no longer change.',
  'The file has no column 7.',
  'Map the required columns before importing.',
  'This is an older Excel (.xls) file. Save it as .xlsx or .csv and upload it again.',
  'PDF files cannot be imported. Upload a .csv or .xlsx file.',
  'This is not a CSV or Excel (.xlsx) file.',
  'The file has a header row but no data rows.',
  'The first row must hold the column names.',
  'A quoted value starting on row 12 is never closed.',
  'The file is not a valid Excel workbook.',
  'The workbook is damaged.',
  'The workbook is password-protected.',
  'The workbook is damaged or too large to read.',
  'The workbook uses a compression method Montra cannot read.',
  'The workbook has no worksheet.',
  'The sheet has more than 50 columns.',
  // apps/api: imports, rows and notices
  'This row has more values than the header has columns. Check for an unquoted separator.',
  'The description is missing.',
  'The category is missing.',
  'Amounts in USD cannot be imported: this business records amounts in EUR.',
  '“Refund” is not a type Montra knows. Use Income or Expense.',
  'The type is missing. Use Income or Expense.',
  'The amount is zero.',
  'The amount is negative, but the type is income.',
  'The amount is not a number.',
  'The amount is missing.',
  '“12,3,4” is not an amount.',
  'The date is missing.',
  '“31/02” is not a date.',
  '“yesterday” is not a date Montra can read.',
  'Use an id of at most 100 characters.',
  'No type given; read from the amount’s sign.',
  'Dates are read day first: 05.10.2026 is 5 October 2026.',
  'Dates are read month first: 10/05/2026 is 5 October 2026.',
  'Amounts use a comma for decimals: 1.250,50 means 1250.50.',
  'There is no type column: negative amounts are imported as expenses, others as income.',
  'There is no category column: every record is filed under “Uncategorised”.',
  'Records without a category are filed under “Uncategorised”.',
  'Not imported: Balance, Notes.',
  // apps/api: imports, duplicates (wording as in apps/api/test/imports.test.ts)
  'Already imported (id TX-1001).',
  'The id X-1 appears earlier in this file.',
  'A transaction with the same date, type, amount and description already exists.',
];

describe('server messages in Bulgarian', () => {
  it.each(SERVER_MESSAGES)('translates “%s”', (message) => {
    const bulgarian = bulgarianFor(message);
    expect(bulgarian).toBeDefined();
    expect(bulgarian).toMatch(/[а-яА-Я]/);
  });

  it('keeps the values a message carries', () => {
    expect(
      bulgarianFor('The file has more than 5000 rows. Split it into smaller files.'),
    ).toContain('5000');
    expect(bulgarianFor('“Refund” is not a type Montra knows. Use Income or Expense.')).toContain(
      '„Refund“',
    );
    expect(bulgarianFor('Too many attempts. Try again in 1 minute.')).toContain('1 минута');
    expect(bulgarianFor('Too many attempts. Try again in 15 minutes.')).toContain('15 минути');
    expect(bulgarianFor('Already imported (id TX-1001).')).toBe(
      'Записът вече е импортиран (идентификатор TX-1001).',
    );
    // An external id is whatever the file holds, brackets and spaces included.
    expect(bulgarianFor('Already imported (id INV (2026) 7).')).toContain('INV (2026) 7');
    expect(bulgarianFor('The id X-1 appears earlier in this file.')).toBe(
      'Идентификаторът X-1 се среща по-рано в този файл.',
    );
  });

  it('passes messages through unchanged in English', () => {
    expect(localizeMessage('Incorrect email or password.', 'INVALID_CREDENTIALS')).toBe(
      'Incorrect email or password.',
    );
  });

  it('falls back to the error code, then to the original, for a message it does not know', () => {
    useUiStore.setState({ language: 'bg' });
    expect(localizeMessage('A brand-new message.', 'IMPORT_FILE_EMPTY')).toBe('Файлът е празен.');
    expect(localizeMessage('A brand-new message.', 'SOMETHING_NEW')).toBe('A brand-new message.');
    expect(localizeMessage('Incorrect email or password.')).toBe('Грешен имейл или парола.');
  });

  it('gives a server failure (INTERNAL_ERROR) a Bulgarian message, whatever its wording', () => {
    useUiStore.setState({ language: 'bg' });
    const bulgarian = 'Нещо се обърка от наша страна. Опитайте отново.';
    expect(localizeMessage('Something went wrong on our side.', 'INTERNAL_ERROR')).toBe(bulgarian);
    expect(localizeMessage('Database connection pool exhausted.', 'INTERNAL_ERROR')).toBe(
      bulgarian,
    );

    useUiStore.setState({ language: 'en' });
    expect(localizeMessage('Something went wrong on our side.', 'INTERNAL_ERROR')).toBe(
      'Something went wrong on our side.',
    );
  });
});
