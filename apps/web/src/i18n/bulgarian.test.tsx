import type { ImportEntry } from '@montra/shared';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetSessionForTests } from '../api/session';
import { Toaster } from '../components/ui/Toaster';
import { PreviewEntries } from '../features/imports/PreviewEntries';
import { compactMoney, count, formatDate, money, percent, relativeDay } from '../lib/format';
import { showToast, useToastStore } from '../stores/toasts';
import { useUiStore } from '../stores/ui';
import { apiError, mockApi } from '../test/authApi';
import { renderApp } from '../test/renderApp';

const REFRESH = 'POST /api/v1/auth/refresh';
const LOGIN = 'POST /api/v1/auth/login';
const noSession = () =>
  apiError(401, 'INVALID_REFRESH_TOKEN', 'Your session has ended. Sign in again.');

/** Intl separates Bulgarian amounts with no-break spaces; compare them as plain spaces. */
const plain = (text: string) => text.replace(/[\u00a0\u202f]/g, ' ');

beforeEach(() => {
  resetSessionForTests();
  useUiStore.setState({ language: 'bg' });
});
afterEach(() => {
  resetSessionForTests();
  useToastStore.setState({ toasts: [] });
  useUiStore.setState({ language: 'en' });
  document.documentElement.lang = 'en';
});

describe('formatting in Bulgarian', () => {
  it('writes money, counts and percentages the Bulgarian way', () => {
    expect(plain(money(123456))).toBe('1234,56 €');
    expect(plain(money(1234567))).toBe('12 345,67 €');
    expect(plain(money(-78000))).toBe('−780,00 €');
    expect(plain(money(342000, { sign: 'always', decimals: 0 }))).toBe('+3420 €');
    expect(plain(count(12345))).toBe('12 345');
    expect(plain(percent(0.234))).toBe('23%');
    expect(plain(compactMoney(1_523_000))).toMatch(/^15,2 хил\. €$/);
  });

  it('names months, weekdays and nearby days in Bulgarian', () => {
    const today = new Date(2026, 10, 17);
    expect(formatDate('2026-11-02')).toBe('2 ное 2026');
    expect(formatDate('2026-11-17', 'EEEE, d MMMM yyyy')).toBe('вторник, 17 ноември 2026');
    expect(relativeDay('2026-11-17', today)).toBe('Днес');
    expect(relativeDay('2026-11-18', today)).toBe('Утре');
    expect(relativeDay('2026-11-16', today)).toBe('Вчера');
  });
});

describe('labels only screen readers hear', () => {
  it('names the toast area in the interface language', () => {
    const { unmount } = render(<Toaster />);
    expect(screen.getByRole('region', { name: 'Известия (F8)' })).toBeInTheDocument();
    unmount();

    useUiStore.setState({ language: 'en' });
    render(<Toaster />);
    expect(screen.getByRole('region', { name: 'Notifications (F8)' })).toBeInTheDocument();
  });

  it('announces a new toast in the interface language', async () => {
    render(<Toaster />);
    act(() => showToast({ tone: 'positive', title: 'Добре дошли отново' }));
    // Radix reads out "<label> <title>" from a visually hidden live region.
    expect(
      await screen.findByText((_, el) => el?.textContent === 'Известие Добре дошли отново'),
    ).toBeInTheDocument();
  });
});

describe('import notes in Bulgarian', () => {
  const entry = (index: number, overrides: Partial<ImportEntry>): ImportEntry => ({
    index,
    row: index + 2,
    status: 'DUPLICATE',
    transaction: {
      type: 'EXPENSE',
      amountCents: 1000,
      description: `Запис ${index}`,
      category: 'Банка',
      date: '2026-10-01',
      externalId: null,
    },
    issues: [],
    notes: [],
    duplicateOf: 't1',
    cells: null,
    ...overrides,
  });

  it('shows the API’s duplicate notes, in its current wording, in Bulgarian', () => {
    // Exactly as apps/api/src/modules/imports/duplicates.ts writes them.
    const entries = [
      entry(0, { notes: ['Already imported (id TX-1001).'] }),
      entry(1, { notes: ['The id X-1 appears earlier in this file.'] }),
      entry(2, {
        status: 'POSSIBLE_DUPLICATE',
        notes: ['A transaction with the same date, type, amount and description already exists.'],
      }),
    ];
    render(
      <PreviewEntries
        entries={entries}
        summary={{ total: 3, valid: 0, invalid: 0, duplicates: 2, possibleDuplicates: 1 }}
        currency="EUR"
        included={new Set()}
        onToggleIncluded={() => {}}
        canInclude
      />,
    );

    expect(
      screen.getByText('Записът вече е импортиран (идентификатор TX-1001).'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Идентификаторът X-1 се среща по-рано в този файл.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Вече има транзакция със същите дата, тип, сума и описание.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/already|appears earlier/i)).not.toBeInTheDocument();
  });
});

describe('the app in Bulgarian', () => {
  it('signs in in Bulgarian, shows the API’s error in Bulgarian, and switches to English', async () => {
    mockApi({
      [REFRESH]: noSession,
      [LOGIN]: () => apiError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.'),
    });
    renderApp('/login');
    const user = userEvent.setup();

    expect(await screen.findByRole('heading', { name: 'Добре дошли отново' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('bg');

    await user.type(screen.getByLabelText('Имейл'), 'ana@example.com');
    await user.type(screen.getByLabelText('Парола'), 'wrong password');
    await user.click(screen.getByRole('button', { name: 'Вход' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Грешен имейл или парола.');

    // Validation from the shared schemas is translated too.
    await user.clear(screen.getByLabelText('Имейл'));
    await user.type(screen.getByLabelText('Имейл'), 'not-an-email');
    await user.tab();
    expect(await screen.findByText('Въведете валиден имейл адрес.')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'English' }));
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
    expect(useUiStore.getState().language).toBe('en');
  });
});
