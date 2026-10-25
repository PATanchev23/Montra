-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'VIEWER');

-- CreateEnum
CREATE TYPE "OnboardingStep" AS ENUM ('BUSINESS_DETAILS', 'FINANCIAL_PREFERENCES', 'REVIEW');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "lowBalanceThresholdCents" INTEGER;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("userId","businessId")
);

-- CreateTable
CREATE TABLE "OnboardingProgress" (
    "userId" TEXT NOT NULL,
    "currentStep" "OnboardingStep" NOT NULL DEFAULT 'BUSINESS_DETAILS',
    "draft" JSONB NOT NULL DEFAULT '{}',
    "completedAt" TIMESTAMPTZ(3),
    "businessId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OnboardingProgress_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Membership_businessId_idx" ON "Membership"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingProgress_businessId_key" ON "OnboardingProgress"("businessId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingProgress" ADD CONSTRAINT "OnboardingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingProgress" ADD CONSTRAINT "OnboardingProgress_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Invariants Prisma cannot express (kept in sync with comments in schema.prisma) ──

-- Emails are stored normalised so the unique index is effectively case-insensitive.
ALTER TABLE "User" ADD CONSTRAINT "User_email_normalized_check"
  CHECK ("email" = lower(btrim("email")) AND "email" <> '');
ALTER TABLE "User" ADD CONSTRAINT "User_name_not_blank_check"
  CHECK (btrim("name") <> '');

ALTER TABLE "Session" ADD CONSTRAINT "Session_expiry_after_creation_check"
  CHECK ("expiresAt" > "createdAt");

ALTER TABLE "Business" ADD CONSTRAINT "Business_fiscal_year_start_month_check"
  CHECK ("fiscalYearStartMonth" BETWEEN 1 AND 12);
ALTER TABLE "Business" ADD CONSTRAINT "Business_low_balance_threshold_check"
  CHECK ("lowBalanceThresholdCents" IS NULL OR "lowBalanceThresholdCents" >= 0);

-- Completed onboarding must always point at the business it created.
ALTER TABLE "OnboardingProgress" ADD CONSTRAINT "OnboardingProgress_completed_has_business_check"
  CHECK ("completedAt" IS NULL OR "businessId" IS NOT NULL);
ALTER TABLE "OnboardingProgress" ADD CONSTRAINT "OnboardingProgress_draft_is_object_check"
  CHECK (jsonb_typeof("draft") = 'object');
