import { currentLanguage } from '.';

/*
 * The API and the shared validation schemas write their messages in English,
 * for the person reading them. In Bulgarian they are translated here, in the
 * browser, so the server stays language-neutral:
 *
 *   1. an exact message, looked up as is;
 *   2. a message with a value in it (a count, a column, a cell), matched by pattern;
 *   3. otherwise a Bulgarian message for the error code, so a message added on
 *      the server later still reaches a Bulgarian reader in Bulgarian.
 *
 * Keep this table in step with apps/api and packages/shared; serverMessages.test.ts
 * lists the messages it must cover.
 */

const EXACT: Record<string, string> = {
  // Auth and access
  'Incorrect email or password.': 'Грешен имейл или парола.',
  'An account with this email already exists.': 'Вече има профил с този имейл.',
  'Your session has ended. Sign in again.': 'Сесията ви изтече. Влезте отново.',
  'Sign in to continue.': 'Влезте, за да продължите.',
  'Requests from this origin are not allowed.': 'Заявки от този адрес не са разрешени.',
  'Incorrect password.': 'Грешна парола.',
  'Demo accounts cannot be deleted.': 'Демо профилите не могат да бъдат изтрити.',
  'Business not found.': 'Бизнесът не е намерен.',
  'Only the business owner can make changes.':
    'Само собственикът на бизнеса може да прави промени.',
  'The request is invalid.': 'Заявката е невалидна.',

  // Client-side failures (api/client.ts)
  'Could not reach the Montra API.': 'Няма връзка със сървъра на Montra.',
  'The API returned an unexpected response.': 'Сървърът върна неочакван отговор.',
  'Could not restore your session.': 'Сесията ви не може да се възстанови.',

  // Validation (packages/shared)
  'Use a shorter email address.': 'Използвайте по-кратък имейл адрес.',
  'Enter a valid email address.': 'Въведете валиден имейл адрес.',
  'Enter your name.': 'Въведете името си.',
  'Enter your password.': 'Въведете паролата си.',
  'Enter the business name.': 'Въведете името на бизнеса.',
  'Choose a supported currency.': 'Изберете поддържана валута.',
  'Choose a valid time zone.': 'Изберете валидна часова зона.',
  'Choose a month.': 'Изберете месец.',
  'Enter a whole amount in cents.': 'Въведете цяла сума в центове.',
  'The threshold cannot be negative.': 'Прагът не може да е отрицателен.',
  'The threshold is too large.': 'Прагът е твърде голям.',
  'The balance is too large.': 'Наличността е твърде голяма.',
  'Choose today or an earlier date.': 'Изберете днешна или по-ранна дата.',
  'Choose income or expense.': 'Изберете приход или разход.',
  'Enter a date.': 'Въведете дата.',
  'Enter a real date as YYYY-MM-DD.': 'Въведете съществуваща дата във формат ГГГГ-ММ-ДД.',
  'Enter a date between 1900 and 2199.': 'Въведете дата между 1900 и 2199 г.',
  'Enter the amount in whole cents.': 'Въведете сумата в цели центове.',
  'The amount must be greater than zero.': 'Сумата трябва да е по-голяма от нула.',
  'The amount is too large.': 'Сумата е твърде голяма.',
  'Enter a description.': 'Въведете описание.',
  'Enter a category.': 'Въведете категория.',
  'Change at least one field.': 'Променете поне едно поле.',
  'Map each column to one field at most.': 'Всяка колона може да отговаря най-много на едно поле.',
  '`from` and `to` apply only to a custom period.':
    'Началната и крайната дата важат само за избран период.',
  'A custom period needs both `from` and `to`.': 'Избраният период изисква начална и крайна дата.',
  '`from` must not be after `to`.': 'Началната дата не може да е след крайната.',

  // Transaction form (features/transactions/formSchema.ts)
  'Enter an amount.': 'Въведете сума.',
  'Enter the amount without a sign; choose income or expense instead.':
    'Въведете сумата без знак; вместо това изберете приход или разход.',
  'Enter an amount such as 89.99.': 'Въведете сума, например 89,99.',
  'Enter an amount such as 2500 or 2500.50.': 'Въведете сума, например 2500 или 2500,50.',
  'Use at most two decimal places.': 'Използвайте най-много два знака след десетичната запетая.',

  // Onboarding
  'Your business is already set up. Onboarding cannot be repeated.':
    'Бизнесът ви вече е настроен. Първоначалната настройка не може да се повтори.',
  'Some required business details are still missing.':
    'Все още липсват някои задължителни данни за бизнеса.',
  'Your answers changed while finishing setup. Review them and try again.':
    'Отговорите ви се промениха, докато настройката приключваше. Прегледайте ги и опитайте отново.',

  // Transactions
  'Transaction not found.': 'Транзакцията не е намерена.',

  // Imports: the request and the file
  'Import not found.': 'Импортът не е намерен.',
  'Send the file itself as the request body, not as a form or JSON.':
    'Изпратете самия файл като тяло на заявката, а не като формуляр или JSON.',
  'Upload a .csv or .xlsx file.': 'Качете файл .csv или .xlsx.',
  'The file is empty.': 'Файлът е празен.',
  'This is an Excel workbook. Import it as an Excel file.':
    'Това е Excel работна книга. Импортирайте я като Excel файл.',
  'This is a CSV file. Import it as a CSV file.': 'Това е CSV файл. Импортирайте го като CSV файл.',
  'Map the required columns before importing.':
    'Съпоставете задължителните колони, преди да импортирате.',
  'This is an older Excel (.xls) file. Save it as .xlsx or .csv and upload it again.':
    'Това е по-стар Excel файл (.xls). Запазете го като .xlsx или .csv и го качете отново.',
  'PDF files cannot be imported. Upload a .csv or .xlsx file.':
    'PDF файлове не могат да се импортират. Качете файл .csv или .xlsx.',
  'This is not a CSV or Excel (.xlsx) file.': 'Това не е CSV или Excel (.xlsx) файл.',
  'The file has a header row but no data rows.': 'Файлът има заглавен ред, но няма редове с данни.',
  'The first row must hold the column names.': 'Първият ред трябва да съдържа имената на колоните.',
  'The file is not a valid Excel workbook.': 'Файлът не е валидна Excel работна книга.',
  'The workbook is damaged.': 'Работната книга е повредена.',
  'The workbook is password-protected.': 'Работната книга е защитена с парола.',
  'The workbook is damaged or too large to read.':
    'Работната книга е повредена или е твърде голяма, за да се прочете.',
  'The workbook uses a compression method Montra cannot read.':
    'Работната книга използва компресия, която Montra не може да прочете.',
  'The workbook has no worksheet.': 'Работната книга няма работен лист.',

  // Imports: rows
  'This row has more values than the header has columns. Check for an unquoted separator.':
    'Този ред има повече стойности, отколкото колони в заглавния ред. Проверете за разделител извън кавички.',
  'The description is missing.': 'Липсва описание.',
  'The category is missing.': 'Липсва категория.',
  'The type is missing. Use Income or Expense.': 'Липсва тип. Използвайте „приход“ или „разход“.',
  'The amount is zero.': 'Сумата е нула.',
  'The amount is negative, but the type is income.': 'Сумата е отрицателна, но типът е приход.',
  'The amount is not a number.': 'Сумата не е число.',
  'The amount is missing.': 'Липсва сума.',
  'The date is missing.': 'Липсва дата.',
  'No type given; read from the amount’s sign.':
    'Няма посочен тип; определен е по знака на сумата.',

  // Imports: how the file was read
  'Dates are read day first: 05.10.2026 is 5 October 2026.':
    'Датите се четат с деня първо: 05.10.2026 е 5 октомври 2026 г.',
  'Dates are read month first: 10/05/2026 is 5 October 2026.':
    'Датите се четат с месеца първо: 10/05/2026 е 5 октомври 2026 г.',
  'Amounts use a comma for decimals: 1.250,50 means 1250.50.':
    'Сумите използват запетая за десетичен знак: 1.250,50 означава 1250,50.',
  'There is no type column: negative amounts are imported as expenses, others as income.':
    'Няма колона за тип: отрицателните суми се импортират като разходи, останалите като приходи.',

  // Imports: duplicates (apps/api/src/modules/imports/duplicates.ts)
  'A transaction with the same date, type, amount and description already exists.':
    'Вече има транзакция със същите дата, тип, сума и описание.',

  // Server failures (apps/api/src/plugins/errors.ts)
  'Something went wrong on our side.': 'Нещо се обърка от наша страна. Опитайте отново.',
};

const UNITS: Record<string, [one: string, many: string]> = {
  second: ['секунда', 'секунди'],
  minute: ['минута', 'минути'],
  hour: ['час', 'часа'],
};

const PATTERNS: [RegExp, (...groups: string[]) => string][] = [
  [
    /^Too many attempts\. Try again in (\d+) (second|minute|hour)s?\.$/,
    (n, unit) => {
      const [one, many] = UNITS[unit!]!;
      return `Твърде много опити. Опитайте отново след ${n} ${n === '1' ? one : many}.`;
    },
  ],
  [/^Use at least (\d+) characters\.$/, (n) => `Използвайте поне ${n} знака.`],
  [/^Use at most (\d+) characters\.$/, (n) => `Използвайте най-много ${n} знака.`],
  [
    /^Use an id of at most (\d+) characters\.$/,
    (n) => `Идентификаторът може да е най-много ${n} знака.`,
  ],
  [/^Choose at most (\d+) days\.$/, (n) => `Изберете най-много ${n} дни.`],
  [/^The file is larger than (\d+) MB\.$/, (n) => `Файлът е по-голям от ${n} MB.`],
  [
    /^The file has more than (\d+) rows\. Split it into smaller files\.$/,
    (n) => `Файлът има повече от ${n} реда. Разделете го на по-малки файлове.`,
  ],
  [/^The sheet has more than (\d+) columns\.$/, (n) => `Листът има повече от ${n} колони.`],
  [/^The file has no column (\d+)\.$/, (n) => `Файлът няма колона ${n}.`],
  [
    /^A quoted value starting on row (\d+) is never closed\.$/,
    (n) => `Стойност в кавички, започваща на ред ${n}, не е затворена.`,
  ],
  [
    /^This is not the Montra template\. Missing columns: (.+)\.$/,
    (cols) => `Това не е шаблонът на Montra. Липсващи колони: ${cols}.`,
  ],
  [
    /^There are already (\d+) imports waiting for review\. Confirm or cancel one first\.$/,
    (n) => `Вече има ${n} импорта, които чакат преглед. Първо потвърдете или откажете един от тях.`,
  ],
  [
    /^This import is (.+) and can no longer change\.$/,
    (status) =>
      `Този импорт е ${
        { completed: 'завършен', cancelled: 'отказан', expired: 'изтекъл', failed: 'неуспешен' }[
          status
        ] ?? status
      } и вече не може да се променя.`,
  ],
  [
    /^This business records amounts in ([A-Z]{3})\. Convert the amount before adding it\.$/,
    (cur) => `Този бизнес води сумите си в ${cur}. Превърнете сумата, преди да я добавите.`,
  ],
  [
    /^Amounts in ([A-Z]{3}) cannot be imported: this business records amounts in ([A-Z]{3})\.$/,
    (row, cur) => `Суми в ${row} не могат да се импортират: този бизнес води сумите си в ${cur}.`,
  ],
  [
    /^“(.*)” is not a type Montra knows\. Use Income or Expense\.$/s,
    (v) => `„${v}“ не е тип, който Montra познава. Използвайте „приход“ или „разход“.`,
  ],
  [/^“(.*)” is not an amount\.$/s, (v) => `„${v}“ не е сума.`],
  [
    /^“(.*)” is not a date Montra can read\.$/s,
    (v) => `„${v}“ не е дата, която Montra може да прочете.`,
  ],
  [/^“(.*)” is not a date\.$/s, (v) => `„${v}“ не е дата.`],
  [
    /^There is no category column: every record is filed under “(.*)”\.$/s,
    (c) => `Няма колона за категория: всеки запис се отнася към „${c}“.`,
  ],
  [
    /^Records without a category are filed under “(.*)”\.$/s,
    (c) => `Записите без категория се отнасят към „${c}“.`,
  ],
  [/^Not imported: (.+)\.$/s, (cols) => `Не се импортират: ${cols}.`],
  [/^Already imported \(id (.+)\)\.$/s, (id) => `Записът вече е импортиран (идентификатор ${id}).`],
  [
    /^The id (.+) appears earlier in this file\.$/s,
    (id) => `Идентификаторът ${id} се среща по-рано в този файл.`,
  ],
  [/^Request failed with status (\d+)\.$/, (n) => `Заявката не бе успешна (код ${n}).`],
];

/** Bulgarian for an error code, when its message is not in the table above. */
const BY_CODE: Record<string, string> = {
  NETWORK_ERROR: 'Няма връзка със сървъра на Montra.',
  INTERNAL_ERROR: 'Нещо се обърка от наша страна. Опитайте отново.',
  VALIDATION_ERROR: 'Някои данни не са верни. Проверете ги и опитайте отново.',
  NOT_FOUND: 'Не е намерено.',
  FORBIDDEN: 'Нямате права за това действие.',
  TOO_MANY_REQUESTS: 'Твърде много опити. Опитайте отново малко по-късно.',
  INVALID_CREDENTIALS: 'Грешен имейл или парола.',
  EMAIL_TAKEN: 'Вече има профил с този имейл.',
  INVALID_ACCESS_TOKEN: 'Влезте, за да продължите.',
  INVALID_REFRESH_TOKEN: 'Сесията ви изтече. Влезте отново.',
  INVALID_PASSWORD: 'Грешна парола.',
  ACCOUNT_PROTECTED: 'Демо профилите не могат да бъдат изтрити.',
  CURRENCY_MISMATCH: 'Валутата не съвпада с валутата на бизнеса.',
  IMPORT_FILE_EMPTY: 'Файлът е празен.',
  IMPORT_FILE_TOO_LARGE: 'Файлът е твърде голям.',
  IMPORT_UNSUPPORTED_FILE: 'Този вид файл не може да се импортира. Качете файл .csv или .xlsx.',
  IMPORT_FILE_UNREADABLE: 'Файлът не може да се прочете.',
  IMPORT_TOO_MANY_ROWS: 'Файлът има твърде много редове. Разделете го на по-малки файлове.',
  IMPORT_SOURCE_MISMATCH: 'Файлът не отговаря на избрания вид импорт.',
  IMPORT_COLUMNS_MISSING: 'Това не е шаблонът на Montra: липсват колони.',
  IMPORT_NOT_PENDING: 'Този импорт вече не може да се променя.',
  IMPORT_MAPPING_INCOMPLETE: 'Съпоставете задължителните колони, преди да импортирате.',
  IMPORT_TOO_MANY_PENDING:
    'Твърде много импорти чакат преглед. Първо потвърдете или откажете един.',
  ONBOARDING_ALREADY_COMPLETED: 'Бизнесът ви вече е настроен.',
  ONBOARDING_INCOMPLETE: 'Все още липсват някои задължителни данни за бизнеса.',
  ONBOARDING_CHANGED: 'Отговорите ви се промениха. Прегледайте ги и опитайте отново.',
};

/** The Bulgarian for an English server or validation message, or undefined if it is not known. */
export function bulgarianFor(message: string): string | undefined {
  const exact = EXACT[message];
  if (exact) return exact;
  for (const [pattern, build] of PATTERNS) {
    const match = pattern.exec(message);
    if (match) return build(...match.slice(1));
  }
  return undefined;
}

/**
 * A server or validation message in the interface language. English passes
 * through; Bulgarian uses the table, then the error code, then the English
 * original as a last resort (better than nothing).
 */
export function localizeMessage(message: string, code?: string): string {
  if (currentLanguage() === 'en') return message;
  return bulgarianFor(message) ?? (code ? BY_CODE[code] : undefined) ?? message;
}
