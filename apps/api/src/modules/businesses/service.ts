import {
  BUSINESS_ERROR_CODES,
  BUSINESS_LIMITS,
  currencySchema,
  DEFAULT_TIMEZONE,
  todayIn,
  type CreateBusinessRequest,
  type CreateBusinessResponse,
  type MembershipSummary,
  type PlanId,
} from '@montra/shared';
import type { Db } from '../../db';
import { Prisma, type Plan } from '../../generated/prisma/client';
import { AppError } from '../../lib/app-error';
import { slugify, suffixedSlug } from '../../lib/slug';
import { toDbDate } from '../transactions/service';

/** Attempts at finding a free slug when concurrent requests pick the same one. */
export const SLUG_ATTEMPTS = 4;

/** A transaction client, as passed to db.$transaction's callback. */
type Tx = Prisma.TransactionClient;

const PLAN_IDS: Record<Plan, PlanId> = { FREE: 'free', PRO: 'pro', BUSINESS: 'business' };

/**
 * Creates a business from onboarding's answers and makes the user its OWNER,
 * inside the caller's transaction. Shared by onboarding (the first business)
 * and POST /businesses (every one after it), so both build a business the
 * same way. A slug collision surfaces as a unique violation for the caller
 * to retry with `preferPlainSlug` off.
 */
export async function createOwnedBusiness(
  tx: Tx,
  userId: string,
  { businessDetails: details, financialPreferences: preferences = {} }: CreateBusinessRequest,
  preferPlainSlug: boolean,
): Promise<MembershipSummary> {
  // The balance was typed as "today": it is recorded as of the day the
  // business is created, where the business is, and forecasts carry it forward.
  const balance = preferences.bankBalanceCents ?? null;
  const balanceDate = balance === null ? null : toDbDate(todayWhere(details.timezone));

  const base = slugify(details.name);
  const plainTaken = await tx.business.findUnique({ where: { slug: base }, select: { id: true } });
  const slug = preferPlainSlug && !plainTaken ? base : suffixedSlug(base);

  const business = await tx.business.create({
    data: {
      slug,
      name: details.name,
      currency: details.currency,
      timezone: details.timezone,
      industry: details.industry || null,
      fiscalYearStartMonth: preferences.fiscalYearStartMonth,
      lowBalanceThresholdCents: preferences.lowBalanceThresholdCents ?? null,
      cashBalanceCents: balance,
      cashBalanceDate: balanceDate,
    },
    select: { id: true, slug: true, name: true, currency: true, timezone: true },
  });
  await tx.membership.create({ data: { userId, businessId: business.id, role: 'OWNER' } });
  return {
    role: 'OWNER',
    business: { ...business, currency: currencySchema.parse(business.currency) },
  };
}

/**
 * Another business for an account that already owns one, within its plan's
 * limit. The limit counts only businesses the account owns. The check and the
 * insert share a transaction that first locks the user's row, so two requests
 * at once cannot both pass the check and end up over the limit.
 */
export async function createAdditionalBusiness(
  db: Db,
  userId: string,
  request: CreateBusinessRequest,
): Promise<CreateBusinessResponse> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        // Taking the row lock: concurrent creates for this account queue here.
        const user = await tx.user.update({
          where: { id: userId },
          data: { updatedAt: new Date() },
          select: { plan: true },
        });
        const owned = await tx.membership.count({ where: { userId, role: 'OWNER' } });
        if (owned === 0) {
          throw new AppError(
            409,
            BUSINESS_ERROR_CODES.ONBOARD_FIRST,
            'Set up your first business before adding another.',
          );
        }
        const plan = PLAN_IDS[user.plan];
        const limit = BUSINESS_LIMITS[plan];
        if (owned >= limit) {
          throw new AppError(
            403,
            BUSINESS_ERROR_CODES.LIMIT_REACHED,
            limit === 1
              ? 'Your plan includes one business. Upgrade to Pro or Business to add another.'
              : `Your plan includes up to ${limit} businesses, and you have reached that.`,
          );
        }
        return { membership: await createOwnedBusiness(tx, userId, request, attempt === 0) };
      });
    } catch (err) {
      // The slug is the only unique value chosen here: on a collision, pick again.
      if (isUniqueViolation(err) && attempt + 1 < SLUG_ATTEMPTS) continue;
      throw err;
    }
  }
}

export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

function todayWhere(timeZone: string): string {
  try {
    return todayIn(timeZone);
  } catch {
    // Time zones are validated on save; this guards against one later dropped from the runtime.
    return todayIn(DEFAULT_TIMEZONE);
  }
}
