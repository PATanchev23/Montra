import {
  DASHBOARD_RECENT_COUNT,
  DASHBOARD_TOP_CATEGORIES,
  DEFAULT_TIMEZONE,
  currencySchema,
  isoDaysBetween,
  resolvePeriod,
  shareBasisPoints,
  todayIn,
  trendBuckets,
  type ComparedAmount,
  type DashboardPeriod,
  type DashboardResponse,
} from '@montra/shared';
import type { Db } from '../../db';
import { Prisma } from '../../generated/prisma/client';
import { fromDbDate, toDbDate, toTransaction, transactionSelect } from '../transactions/service';

/*
 * The Dashboard's figures, computed from the business's transactions only.
 * Every sum is of integer cents in the database, so nothing is rounded until
 * the client formats it. All queries run in one REPEATABLE READ transaction,
 * so the overview, trend and breakdown describe the same snapshot.
 */

type Tx = Prisma.TransactionClient;

function compared(cents: number, previousCents: number): ComparedAmount {
  return {
    cents,
    previousCents,
    changeCents: cents - previousCents,
    changeRatio: previousCents === 0 ? null : (cents - previousCents) / Math.abs(previousCents),
  };
}

function today(timeZone: string, now: Date): string {
  try {
    return todayIn(timeZone, now);
  } catch {
    // Time zones are validated when set; this guards against one later dropped from the runtime.
    return todayIn(DEFAULT_TIMEZONE, now);
  }
}

const inRange = (businessId: string, from: string, to: string) => ({
  businessId,
  date: { gte: toDbDate(from), lte: toDbDate(to) },
});

/** Income and expense totals, and how many transactions, between two dates. */
async function totals(tx: Tx, businessId: string, from: string, to: string) {
  const groups = await tx.transaction.groupBy({
    by: ['type'],
    where: inRange(businessId, from, to),
    _sum: { amountCents: true },
    _count: { _all: true },
  });
  const of = (type: 'INCOME' | 'EXPENSE') => groups.find((g) => g.type === type);
  return {
    income: of('INCOME')?._sum.amountCents ?? 0,
    expenses: of('EXPENSE')?._sum.amountCents ?? 0,
    count: groups.reduce((sum, g) => sum + g._count._all, 0),
  };
}

/** Expenses by category, merging spellings that differ only in case under the most used one. */
async function expenseBreakdown(tx: Tx, businessId: string, from: string, to: string) {
  const groups = await tx.transaction.groupBy({
    by: ['category'],
    where: { ...inRange(businessId, from, to), type: 'EXPENSE' },
    _sum: { amountCents: true },
    _count: { _all: true },
  });
  const merged = new Map<string, { spellings: [string, number][]; cents: number; count: number }>();
  for (const g of groups) {
    const key = g.category.toLocaleLowerCase('en');
    const entry = merged.get(key) ?? { spellings: [], cents: 0, count: 0 };
    entry.spellings.push([g.category, g._count._all]);
    entry.cents += g._sum.amountCents ?? 0;
    entry.count += g._count._all;
    merged.set(key, entry);
  }
  const categories = [...merged.values()]
    .map(({ spellings, cents, count }) => ({
      category: spellings.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0],
      cents,
      transactionCount: count,
    }))
    .sort((a, b) => b.cents - a.cents || a.category.localeCompare(b.category));

  // The largest categories, then the rest as one; a single leftover category is shown as itself.
  const shown =
    categories.length <= DASHBOARD_TOP_CATEGORIES + 1
      ? categories
      : [
          ...categories.slice(0, DASHBOARD_TOP_CATEGORIES),
          categories.slice(DASHBOARD_TOP_CATEGORIES).reduce(
            (other, c) => ({
              category: null,
              cents: other.cents + c.cents,
              transactionCount: other.transactionCount + c.transactionCount,
            }),
            { category: null as string | null, cents: 0, transactionCount: 0 },
          ),
        ];
  const shares = shareBasisPoints(shown.map((item) => item.cents));
  return {
    totalCents: categories.reduce((sum, c) => sum + c.cents, 0),
    items: shown.map((item, i) => ({ ...item, shareBasisPoints: shares[i]! })),
  };
}

export async function getDashboard(
  db: Db,
  businessId: string,
  query: { period: DashboardPeriod; from?: string; to?: string },
  now: Date = new Date(),
): Promise<DashboardResponse> {
  const business = await db.business.findUniqueOrThrow({
    where: { id: businessId },
    select: { currency: true, timezone: true },
  });
  const day = today(business.timezone, now);
  const period = resolvePeriod(query, day);
  const { from, to, previousFrom, previousTo } = period;

  return db.$transaction(
    async (tx) => {
      const [current, previous, daily, breakdown, recent] = await Promise.all([
        totals(tx, businessId, from, to),
        totals(tx, businessId, previousFrom, previousTo),
        tx.transaction.groupBy({
          by: ['date', 'type'],
          where: inRange(businessId, from, to),
          _sum: { amountCents: true },
        }),
        expenseBreakdown(tx, businessId, from, to),
        tx.transaction.findMany({
          where: { businessId },
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
          take: DASHBOARD_RECENT_COUNT,
          select: transactionSelect,
        }),
      ]);

      const points = trendBuckets(from, to, period.interval).map((bucket) => {
        let incomeCents = 0;
        let expenseCents = 0;
        for (const g of daily) {
          const date = fromDbDate(g.date);
          if (date < bucket.start || date > bucket.end) continue;
          if (g.type === 'INCOME') incomeCents += g._sum.amountCents ?? 0;
          else expenseCents += g._sum.amountCents ?? 0;
        }
        return { ...bucket, incomeCents, expenseCents, netCents: incomeCents - expenseCents };
      });

      return {
        currency: currencySchema.parse(business.currency),
        today: day,
        period: {
          period: period.period,
          from,
          to,
          days: isoDaysBetween(from, to) + 1,
          previousFrom,
          previousTo,
        },
        overview: {
          income: compared(current.income, previous.income),
          expenses: compared(current.expenses, previous.expenses),
          net: compared(current.income - current.expenses, previous.income - previous.expenses),
          transactionCount: current.count,
          previousTransactionCount: previous.count,
        },
        trend: { interval: period.interval, points },
        expenseBreakdown: breakdown,
        recent: recent.map(toTransaction),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
