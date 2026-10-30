import {
  currencySchema,
  ONBOARDING_ERROR_CODES,
  onboardingDraftSchema,
  onboardingSubmissionSchema,
  type CompleteOnboardingResponse,
  type OnboardingDraft,
  type OnboardingProgress,
  type SaveOnboardingRequest,
} from '@montra/shared';
import type { Db } from '../../db';
import { Prisma } from '../../generated/prisma/client';
import type { OnboardingProgressGetPayload } from '../../generated/prisma/models';
import { AppError } from '../../lib/app-error';
import { slugify, suffixedSlug } from '../../lib/slug';
import { onboardingSummary } from './status';

/** Attempts at finding a free slug when concurrent sign-ups pick the same one. */
const SLUG_ATTEMPTS = 4;

const progressSelect = {
  currentStep: true,
  draft: true,
  completedAt: true,
  businessId: true,
  updatedAt: true,
} as const;

type ProgressRow = OnboardingProgressGetPayload<{ select: typeof progressSelect }>;

const alreadyCompleted = () =>
  new AppError(
    409,
    ONBOARDING_ERROR_CODES.ALREADY_COMPLETED,
    'Your business is already set up. Onboarding cannot be repeated.',
  );

/**
 * Drafts are validated on every save, so this only drops data edited into
 * the database by hand. Losing a draft beats failing every request for it.
 */
function readDraft(value: unknown): OnboardingDraft {
  const parsed = onboardingDraftSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

function toProgress(row: ProgressRow | null): OnboardingProgress {
  const draft = readDraft(row?.draft ?? {});
  return {
    ...onboardingSummary(row && { ...row, draft }),
    draft,
    completedAt: row?.completedAt?.toISOString() ?? null,
    businessId: row?.businessId ?? null,
  };
}

/**
 * The user's onboarding. Users without a row (they joined an existing
 * business) read as not started; the row is created on their first save.
 */
export async function getProgress(db: Db, userId: string): Promise<OnboardingProgress> {
  const row = await db.onboardingProgress.findUnique({ where: { userId }, select: progressSelect });
  return toProgress(row);
}

/** Saves the current step and replaces the draft. Completed onboarding is read-only. */
export async function saveProgress(
  db: Db,
  userId: string,
  { currentStep, draft }: SaveOnboardingRequest,
): Promise<OnboardingProgress> {
  const data = { currentStep, draft: draft as Prisma.InputJsonObject };
  const { count } = await db.onboardingProgress.updateMany({
    where: { userId, completedAt: null },
    data,
  });

  if (count === 0) {
    const existing = await db.onboardingProgress.findUnique({
      where: { userId },
      select: { userId: true },
    });
    if (existing) throw alreadyCompleted();
    try {
      await db.onboardingProgress.create({ data: { userId, ...data } });
    } catch (err) {
      // Another request created the row first: save over it (or refuse, if it completed).
      if (isUniqueViolation(err)) return saveProgress(db, userId, { currentStep, draft });
      throw err;
    }
  }

  return getProgress(db, userId);
}

/**
 * Creates the business from the saved draft and makes the user its OWNER.
 * The business, the membership and the completed onboarding are written in
 * one transaction: either all of them exist afterwards, or none do.
 */
export async function completeOnboarding(
  db: Db,
  userId: string,
): Promise<CompleteOnboardingResponse> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await attemptCompletion(db, userId, attempt === 0);
    } catch (err) {
      // The slug is the only unique value the transaction chooses. If another
      // business took it between our check and our insert, pick again.
      if (isUniqueViolation(err) && attempt + 1 < SLUG_ATTEMPTS) continue;
      throw err;
    }
  }
}

async function attemptCompletion(
  db: Db,
  userId: string,
  preferPlainSlug: boolean,
): Promise<CompleteOnboardingResponse> {
  const row = await db.onboardingProgress.findUnique({ where: { userId }, select: progressSelect });
  if (row?.completedAt) throw alreadyCompleted();

  const submission = onboardingSubmissionSchema.safeParse(row?.draft ?? {});
  if (!row || !submission.success) {
    const issues = submission.success ? [] : submission.error.issues;
    throw new AppError(
      422,
      ONBOARDING_ERROR_CODES.INCOMPLETE,
      'Some required business details are still missing.',
      {
        details: issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      },
    );
  }
  const { businessDetails: details, financialPreferences: preferences = {} } = submission.data;

  return db.$transaction(async (tx) => {
    const base = slugify(details.name);
    const plainTaken = await tx.business.findUnique({
      where: { slug: base },
      select: { id: true },
    });
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
      },
      select: { id: true, slug: true, name: true, currency: true, timezone: true },
    });
    await tx.membership.create({ data: { userId, businessId: business.id, role: 'OWNER' } });

    // Matching updatedAt means the row is exactly the draft validated above.
    // A concurrent completion or save changes it, so of two racing requests
    // exactly one gets here; the other's business and membership roll back.
    const { count } = await tx.onboardingProgress.updateMany({
      where: { userId, completedAt: null, updatedAt: row.updatedAt },
      data: { completedAt: new Date(), businessId: business.id, currentStep: 'REVIEW' },
    });
    if (count !== 1) {
      const latest = await tx.onboardingProgress.findUnique({
        where: { userId },
        select: { completedAt: true },
      });
      if (latest?.completedAt) throw alreadyCompleted();
      throw new AppError(
        409,
        ONBOARDING_ERROR_CODES.CHANGED,
        'Your answers changed while finishing setup. Review them and try again.',
      );
    }

    const completed = await tx.onboardingProgress.findUniqueOrThrow({
      where: { userId },
      select: progressSelect,
    });
    return {
      onboarding: toProgress(completed),
      membership: {
        role: 'OWNER',
        business: { ...business, currency: currencySchema.parse(business.currency) },
      },
    };
  });
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}
