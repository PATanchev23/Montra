import type { Transaction } from '@montra/shared';
import { describe, expect, it } from 'vitest';
import {
  amountTextSchema,
  createRequestFrom,
  fieldErrorsFrom,
  formValuesFrom,
  transactionFormSchema,
  updateRequestFrom,
} from './formSchema';

const saved: Transaction = {
  id: 'tx-1',
  type: 'EXPENSE',
  amountCents: 8999,
  description: 'Website hosting',
  category: 'Software',
  date: '2026-10-02',
  importSource: null,
  importBatchId: null,
  externalId: null,
  createdAt: '2026-10-02T09:00:00.000Z',
  updatedAt: '2026-10-02T09:00:00.000Z',
};

const messageOf = (text: string) => amountTextSchema.safeParse(text).error?.issues[0]?.message;

describe('amount as typed', () => {
  it.each([
    ['89.99', 8999],
    ['89,99', 8999],
    ['1 250,50', 125050],
    ['1250', 125000],
    ['0.5', 50],
    [' 12.3 ', 1230],
  ])('reads %j as %i cents', (text, cents) => {
    expect(amountTextSchema.parse(text)).toBe(cents);
  });

  it('explains what is wrong', () => {
    expect(messageOf('')).toBe('Enter an amount.');
    expect(messageOf('abc')).toBe('Enter an amount such as 89.99.');
    expect(messageOf('1,250.50')).toBe('Enter an amount such as 89.99.');
    expect(messageOf('-5')).toBe(
      'Enter the amount without a sign; choose income or expense instead.',
    );
    expect(messageOf('1.234')).toBe('Use at most two decimal places.');
    expect(messageOf('0')).toBe('The amount must be greater than zero.');
    expect(messageOf('99999999999')).toBe('The amount is too large.');
  });
});

describe('the transaction form', () => {
  it('starts a new transaction as an expense dated today', () => {
    const values = formValuesFrom(null);
    expect(values).toMatchObject({ type: 'EXPENSE', amount: '', description: '', category: '' });
    expect(values.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('prefills an existing transaction', () => {
    expect(formValuesFrom(saved)).toEqual({
      type: 'EXPENSE',
      amount: '89.99',
      description: 'Website hosting',
      category: 'Software',
      date: '2026-10-02',
    });
  });

  it('builds a create request in the business currency, with the shared rules applied', () => {
    const data = transactionFormSchema.parse({
      type: 'INCOME',
      amount: '1500',
      description: '  Wholesale order  ',
      category: 'Sales',
      date: '2026-10-01',
    });
    expect(createRequestFrom(data, 'EUR')).toEqual({
      type: 'INCOME',
      amountCents: 150000,
      description: 'Wholesale order',
      category: 'Sales',
      date: '2026-10-01',
      currency: 'EUR',
    });
  });

  it('sends only the fields that changed, or nothing', () => {
    const unchanged = transactionFormSchema.parse(formValuesFrom(saved));
    expect(updateRequestFrom(unchanged, saved, 'EUR')).toBeNull();

    const changed = transactionFormSchema.parse({
      ...formValuesFrom(saved),
      amount: '95',
      category: 'Hosting',
    });
    expect(updateRequestFrom(changed, saved, 'EUR')).toEqual({
      amountCents: 9500,
      category: 'Hosting',
      currency: 'EUR',
    });
  });

  it('maps API validation details onto form fields', () => {
    expect(
      fieldErrorsFrom([
        { path: 'amountCents', message: 'The amount is too large.' },
        { path: 'date', message: 'Enter a real date as YYYY-MM-DD.' },
        { path: 'unknown', message: 'Ignored.' },
        'not an object',
      ]),
    ).toEqual({ amount: 'The amount is too large.', date: 'Enter a real date as YYYY-MM-DD.' });
    expect(fieldErrorsFrom(undefined)).toEqual({});
  });
});
