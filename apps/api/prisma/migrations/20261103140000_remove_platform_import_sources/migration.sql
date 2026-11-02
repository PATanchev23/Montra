-- Montra no longer reads Shopify or WooCommerce exports: drop their ImportSource values.
-- Postgres cannot remove an enum value in place, so the type is rebuilt without them.
--
-- No row may still use them. Rather than change or delete existing transactions or
-- import history, the migration stops with an error (and changes nothing) if any does.

-- AlterEnum
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Transaction" WHERE "importSource"::text IN ('SHOPIFY', 'WOOCOMMERCE'))
    OR EXISTS (SELECT 1 FROM "ImportBatch" WHERE "source"::text IN ('SHOPIFY', 'WOOCOMMERCE'))
  THEN
    RAISE EXCEPTION 'Shopify or WooCommerce imports exist. They must be resolved before these import sources can be removed.';
  END IF;
END $$;
CREATE TYPE "ImportSource_new" AS ENUM ('MONTRA_TEMPLATE', 'GENERIC_CSV', 'GENERIC_EXCEL');
ALTER TABLE "Transaction" ALTER COLUMN "importSource" TYPE "ImportSource_new" USING ("importSource"::text::"ImportSource_new");
ALTER TABLE "ImportBatch" ALTER COLUMN "source" TYPE "ImportSource_new" USING ("source"::text::"ImportSource_new");
ALTER TYPE "ImportSource" RENAME TO "ImportSource_old";
ALTER TYPE "ImportSource_new" RENAME TO "ImportSource";
DROP TYPE "ImportSource_old";
COMMIT;
