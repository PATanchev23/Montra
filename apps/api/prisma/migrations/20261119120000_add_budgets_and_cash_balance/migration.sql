-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "cashBalanceCents" INTEGER,
ADD COLUMN     "cashBalanceDate" DATE;

-- CreateTable
CREATE TABLE "Budget" (
    "businessId" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "limitCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("businessId","categoryKey")
);

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Invariants Prisma cannot express (kept in sync with comments in schema.prisma) ──

-- A balance always says which day it was true.
ALTER TABLE "Business" ADD CONSTRAINT "Business_cash_balance_dated_check"
  CHECK (("cashBalanceCents" IS NULL) = ("cashBalanceDate" IS NULL));

ALTER TABLE "Budget" ADD CONSTRAINT "Budget_limit_positive_check"
  CHECK ("limitCents" > 0);
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_category_not_blank_check"
  CHECK (btrim("category") <> '');
-- categoryKey is set by the API (JavaScript lower-casing). It is not checked
-- against lower() here: under a C collation lower() leaves Cyrillic unchanged.
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_category_key_not_blank_check"
  CHECK ("categoryKey" <> '');
