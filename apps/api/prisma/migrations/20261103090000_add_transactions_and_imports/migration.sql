-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "ImportSource" AS ENUM ('MONTRA_TEMPLATE', 'GENERIC_CSV', 'GENERIC_EXCEL', 'SHOPIFY', 'WOOCOMMERCE');

-- CreateEnum
CREATE TYPE "ImportFileFormat" AS ENUM ('CSV', 'XLSX');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('AWAITING_MAPPING', 'READY', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "importSource" "ImportSource",
    "importBatchId" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdById" TEXT,
    "source" "ImportSource" NOT NULL,
    "fileFormat" "ImportFileFormat" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileSha256" CHAR(64) NOT NULL,
    "status" "ImportStatus" NOT NULL,
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "importedRecords" INTEGER NOT NULL DEFAULT 0,
    "skippedRecords" INTEGER NOT NULL DEFAULT 0,
    "failedRecords" INTEGER NOT NULL DEFAULT 0,
    "mapping" JSONB,
    "pendingData" JSONB,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Transaction_businessId_date_createdAt_id_idx" ON "Transaction"("businessId", "date" DESC, "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "Transaction_businessId_type_date_idx" ON "Transaction"("businessId", "type", "date");

-- CreateIndex
CREATE INDEX "Transaction_businessId_category_idx" ON "Transaction"("businessId", "category");

-- CreateIndex
CREATE INDEX "Transaction_importBatchId_idx" ON "Transaction"("importBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_businessId_externalId_key" ON "Transaction"("businessId", "externalId");

-- CreateIndex
CREATE INDEX "ImportBatch_businessId_createdAt_idx" ON "ImportBatch"("businessId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ImportBatch_businessId_fileSha256_idx" ON "ImportBatch"("businessId", "fileSha256");

-- CreateIndex
CREATE INDEX "ImportBatch_businessId_status_idx" ON "ImportBatch"("businessId", "status");

-- CreateIndex
CREATE INDEX "ImportBatch_createdById_idx" ON "ImportBatch"("createdById");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Invariants Prisma cannot express (kept in sync with comments in schema.prisma) ──

-- Amounts are positive cents; the type gives the direction.
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_amount_positive_check"
  CHECK ("amountCents" > 0);
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_description_not_blank_check"
  CHECK (btrim("description") <> '');
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_category_not_blank_check"
  CHECK (btrim("category") <> '');
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_external_id_not_blank_check"
  CHECK ("externalId" IS NULL OR btrim("externalId") <> '');
-- A transaction from an import always says which kind of import.
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_import_has_source_check"
  CHECK ("importBatchId" IS NULL OR "importSource" IS NOT NULL);

ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_counts_check"
  CHECK ("totalRecords" >= 0 AND "importedRecords" >= 0 AND "skippedRecords" >= 0
    AND "failedRecords" >= 0 AND "fileSize" >= 0);
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_file_name_not_blank_check"
  CHECK (btrim("fileName") <> '');
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_sha256_hex_check"
  CHECK ("fileSha256" ~ '^[0-9a-f]{64}$');
-- A finished import accounts for every record and has a completion time.
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_finished_counts_check"
  CHECK ("status" NOT IN ('COMPLETED', 'FAILED')
    OR ("completedAt" IS NOT NULL
      AND "importedRecords" + "skippedRecords" + "failedRecords" = "totalRecords"));
-- Parsed file contents exist only while the import awaits confirmation.
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_pending_data_check"
  CHECK ("status" IN ('AWAITING_MAPPING', 'READY') OR "pendingData" IS NULL);
