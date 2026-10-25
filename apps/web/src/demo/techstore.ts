/*
 * TechStore sample dataset
 * ────────────────────────
 * A deterministic, realistic history for a small Bulgarian online
 * electronics store, used to design and exercise the interface before the
 * financial REST endpoints exist. Every figure comes from simple, documented
 * business rules plus seeded noise, so it is identical on every load.
 *
 * This file is temporary scaffolding: once the API serves real data it moves
 * into the backend seed (apps/api/prisma/seed) and the UI reads from REST.
 */
import { addDays, differenceInCalendarMonths, format, getDay, getDaysInMonth } from 'date-fns';
import { createRandom, jitter, type Random } from './random';
import type { Account, AccountId, Category, CategoryId, EntryType, Transaction } from './types';

/** The sample data is anchored to a fixed "today" so it never drifts. */
export const DEMO_TODAY = new Date(2026, 9, 25);
export const DEMO_TODAY_ISO = format(DEMO_TODAY, 'yyyy-MM-dd');

const HISTORY_START = new Date(2025, 0, 1);
const PROJECTION_END = addDays(DEMO_TODAY, 120);
const OPENING_BALANCE_CENTS = 650_000;

export const business = {
  name: 'TechStore',
  kind: 'E-commerce business',
  currency: 'EUR',
  owner: { name: 'Presiyan', email: 'presiyan@techstore.example' },
};

export const categories: Category[] = [
  { id: 'sales-store', name: 'Online store', type: 'income' },
  { id: 'sales-marketplace', name: 'Marketplace', type: 'income' },
  { id: 'sales-b2b', name: 'B2B orders', type: 'income' },
  { id: 'inventory', name: 'Inventory', type: 'expense' },
  { id: 'advertising', name: 'Advertising', type: 'expense' },
  { id: 'shipping', name: 'Shipping', type: 'expense' },
  { id: 'payroll', name: 'Payroll', type: 'expense' },
  { id: 'rent', name: 'Rent', type: 'expense' },
  { id: 'software', name: 'Software', type: 'expense' },
  { id: 'fees', name: 'Payment fees', type: 'expense' },
  { id: 'utilities', name: 'Utilities', type: 'expense' },
  { id: 'taxes', name: 'Taxes', type: 'expense' },
];

export const categoryById = Object.fromEntries(categories.map((c) => [c.id, c])) as Record<
  CategoryId,
  Category
>;

export const accounts: Account[] = [
  { id: 'main', name: 'Main account', detail: '•••• 4471' },
  { id: 'card', name: 'Business card', detail: '•••• 9012' },
  { id: 'savings', name: 'Tax reserve', detail: '•••• 3308' },
];

export type EventKind = 'payout' | 'supplier-invoice' | 'recurring' | 'variable';

export interface CashEvent {
  date: string;
  description: string;
  counterparty: string;
  reference?: string;
  categoryId: CategoryId;
  accountId: AccountId;
  type: EntryType;
  /** What actually happened (history) */
  actualCents: number;
  /** What a forecast would expect (no noise) */
  expectedCents: number;
  kind: EventKind;
  /** Fixed amounts (rent, subscriptions) are known in advance. */
  fixed: boolean;
  issueDate?: string;
}

// ── Business rules ────────────────────────────────────────────────────────

/** Seasonality for an electronics shop: quiet summer, strong Black Friday and Christmas. */
const SEASON = [0.8, 0.74, 0.84, 0.88, 0.92, 0.9, 0.86, 0.9, 0.97, 1.02, 1.4, 1.58];
const BASE_MONTHLY_REVENUE = 14_200;
const MONTHLY_GROWTH = 0.011;

function revenueFor(year: number, month: number) {
  const index = differenceInCalendarMonths(new Date(year, month, 1), HISTORY_START);
  return BASE_MONTHLY_REVENUE * SEASON[month]! * (1 + MONTHLY_GROWTH) ** index;
}

const SUPPLIERS = [
  'Nordic Components',
  'VoltLine Distribution',
  'Kestrel Peripherals',
  'Arcadia Mobile Supply',
];
const B2B_CLIENTS = [
  'Novatek Office Ltd',
  'BrightDesk Coworking',
  'Pixel School Sofia',
  'Orbit Dental',
];
const SUBSCRIPTIONS = [
  { day: 5, name: 'Shopify plan', counterparty: 'Shopify', euros: 79 },
  { day: 8, name: 'Klaviyo', counterparty: 'Klaviyo', euros: 60 },
  { day: 12, name: 'Google Workspace', counterparty: 'Google', euros: 28 },
  { day: 18, name: 'Ledgerly accounting', counterparty: 'Ledgerly', euros: 35 },
  { day: 20, name: 'Canva Pro', counterparty: 'Canva', euros: 12 },
];

const cents = (euros: number) => Math.round(euros * 100);
const iso = (date: Date) => format(date, 'yyyy-MM-dd');

function daysWhere(year: number, month: number, weekday: number) {
  const days: number[] = [];
  for (let d = 1; d <= getDaysInMonth(new Date(year, month, 1)); d++) {
    if (getDay(new Date(year, month, d)) === weekday) days.push(d);
  }
  return days;
}

let invoiceSequence = 4100;
let orderSequence = 10_020;

function monthEvents(year: number, month: number, random: Random): CashEvent[] {
  const events: CashEvent[] = [];
  const revenue = revenueFor(year, month);
  const nextRevenue = revenueFor(month === 11 ? year + 1 : year, (month + 1) % 12);
  const prevRevenue = revenueFor(month === 0 ? year - 1 : year, (month + 11) % 12);
  const day = (d: number) => new Date(year, month, d);

  const push = (
    d: Date,
    euros: number,
    spread: number,
    e: Omit<CashEvent, 'date' | 'actualCents' | 'expectedCents' | 'fixed'>,
  ) => {
    events.push({
      ...e,
      date: iso(d),
      expectedCents: cents(euros),
      actualCents: cents(euros * jitter(random, spread)),
      fixed: spread === 0,
    });
  };

  // Income ── Shopify pays out twice a week (Mon, Thu)
  const payoutDays = [...daysWhere(year, month, 1), ...daysWhere(year, month, 4)].sort(
    (a, b) => a - b,
  );
  for (const d of payoutDays) {
    push(day(d), (revenue * 0.6) / payoutDays.length, 0.28, {
      description: 'Shopify payout',
      counterparty: 'Shopify Payments',
      categoryId: 'sales-store',
      accountId: 'main',
      type: 'income',
      kind: 'payout',
    });
  }

  // Income ── marketplace settles weekly on Wednesdays
  const marketDays = daysWhere(year, month, 3);
  for (const d of marketDays) {
    push(day(d), (revenue * 0.27) / marketDays.length, 0.22, {
      description: 'Marketplace payout',
      counterparty: 'Allmart Marketplace',
      categoryId: 'sales-marketplace',
      accountId: 'main',
      type: 'income',
      kind: 'payout',
    });
  }

  // Income ── a few direct B2B orders paid by bank transfer
  for (const [i, d] of [7, 17, 27].entries()) {
    const ref = `#${orderSequence++}`;
    push(day(d), (revenue * 0.13) / 3, 0.45, {
      description: `Order ${ref}`,
      counterparty: B2B_CLIENTS[(month + i) % B2B_CLIENTS.length]!,
      reference: ref,
      categoryId: 'sales-b2b',
      accountId: 'main',
      type: 'income',
      kind: 'variable',
    });
  }

  // Expenses ── inventory bought ahead of next month's demand, paid net-30
  for (const [i, [issue, share]] of (
    [
      [4, 0.4],
      [13, 0.35],
      [22, 0.25],
    ] as const
  ).entries()) {
    const ref = `#${invoiceSequence++}`;
    const issued = day(issue);
    push(addDays(issued, 30), nextRevenue * 0.41 * share, 0.12, {
      description: `Supplier invoice ${ref}`,
      counterparty: SUPPLIERS[(month * 3 + i) % SUPPLIERS.length]!,
      reference: ref,
      categoryId: 'inventory',
      accountId: 'main',
      type: 'expense',
      kind: 'supplier-invoice',
      issueDate: iso(issued),
    });
  }

  // Expenses ── advertising: Meta bills weekly, Google twice a month
  const mondays = daysWhere(year, month, 1);
  for (const d of mondays) {
    push(day(d), (revenue * 0.072) / mondays.length, 0.18, {
      description: 'Meta Ads',
      counterparty: 'Meta Platforms',
      categoryId: 'advertising',
      accountId: 'card',
      type: 'expense',
      kind: 'variable',
    });
  }
  for (const d of [1, 15]) {
    push(day(d), (revenue * 0.045) / 2, 0.15, {
      description: 'Google Ads',
      counterparty: 'Google',
      categoryId: 'advertising',
      accountId: 'card',
      type: 'expense',
      kind: 'variable',
    });
  }

  // Expenses ── courier invoices every Friday
  const fridays = daysWhere(year, month, 5);
  for (const d of fridays) {
    push(day(d), (revenue * 0.058) / fridays.length, 0.15, {
      description: 'Courier invoice',
      counterparty: 'ParcelPoint Courier',
      categoryId: 'shipping',
      accountId: 'main',
      type: 'expense',
      kind: 'variable',
    });
  }

  // Expenses ── fixed monthly costs
  push(day(1), 720, 0, {
    description: 'Warehouse rent',
    counterparty: 'Lozenets Storage Ltd',
    categoryId: 'rent',
    accountId: 'main',
    type: 'expense',
    kind: 'recurring',
  });
  push(day(25), year >= 2026 && month >= 3 ? 3400 : 3250, 0, {
    description: 'Payroll',
    counterparty: 'Staff salaries',
    categoryId: 'payroll',
    accountId: 'main',
    type: 'expense',
    kind: 'recurring',
  });
  push(day(3), prevRevenue * 0.019, 0.05, {
    description: 'Payment processing fees',
    counterparty: 'Shopify Payments',
    categoryId: 'fees',
    accountId: 'main',
    type: 'expense',
    kind: 'variable',
  });
  push(day(16), 110, 0.15, {
    description: 'Internet & power',
    counterparty: 'Utilities',
    categoryId: 'utilities',
    accountId: 'main',
    type: 'expense',
    kind: 'recurring',
  });
  for (const sub of SUBSCRIPTIONS) {
    push(day(sub.day), sub.euros, 0, {
      description: sub.name,
      counterparty: sub.counterparty,
      categoryId: 'software',
      accountId: 'card',
      type: 'expense',
      kind: 'recurring',
    });
  }

  // Expenses ── quarterly VAT settlement from the tax reserve
  if (month % 3 === 0) {
    const quarterRevenue = [1, 2, 3].reduce((sum, back) => {
      const m = (month - back + 12) % 12;
      return sum + revenueFor(month - back < 0 ? year - 1 : year, m);
    }, 0);
    push(day(14), quarterRevenue * 0.034, 0.04, {
      description: `VAT payment Q${month === 0 ? 4 : month / 3}`,
      counterparty: 'National Revenue Agency',
      categoryId: 'taxes',
      accountId: 'savings',
      type: 'expense',
      kind: 'recurring',
    });
  }

  return events;
}

function buildEvents(): CashEvent[] {
  invoiceSequence = 4100;
  orderSequence = 10_020;
  const events: CashEvent[] = [];
  const months = differenceInCalendarMonths(PROJECTION_END, HISTORY_START);
  for (let i = 0; i <= months; i++) {
    const date = new Date(2025, i, 1);
    const random = createRandom(date.getFullYear() * 100 + date.getMonth() + 7);
    events.push(...monthEvents(date.getFullYear(), date.getMonth(), random));
  }
  return events
    .filter((e) => e.date >= iso(HISTORY_START) && e.date <= iso(PROJECTION_END))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── Materialised dataset ─────────────────────────────────────────────────

const events = buildEvents();

/** Everything that has already happened, newest first. */
export const transactions: Transaction[] = events
  .filter((e) => e.date <= DEMO_TODAY_ISO)
  .map((e, index): Transaction => ({
    id: `txn_${String(index).padStart(5, '0')}`,
    date: e.date,
    description: e.description,
    counterparty: e.counterparty,
    reference: e.reference,
    categoryId: e.categoryId,
    accountId: e.accountId,
    type: e.type,
    amountCents: e.actualCents,
    status: e.kind === 'payout' && e.date >= iso(addDays(DEMO_TODAY, -2)) ? 'pending' : 'cleared',
  }))
  .reverse();

/** Expected future movements: known amounts where they exist, averages otherwise. */
export const futureEvents: CashEvent[] = events.filter((e) => e.date > DEMO_TODAY_ISO);

/** Supplier invoices already issued but not yet paid. */
export function isIssuedInvoice(e: CashEvent) {
  return (
    e.kind === 'supplier-invoice' && e.issueDate !== undefined && e.issueDate <= DEMO_TODAY_ISO
  );
}

export const openingBalanceCents = OPENING_BALANCE_CENTS;
export const historyStartIso = iso(HISTORY_START);

/** Monthly budget limits (in cents) TechStore set for each expense category. */
export const budgetLimits: Partial<Record<CategoryId, number>> = {
  inventory: cents(9_200),
  advertising: cents(1_600),
  shipping: cents(950),
  payroll: cents(3_400),
  rent: cents(720),
  software: cents(230),
  fees: cents(320),
  utilities: cents(120),
};
