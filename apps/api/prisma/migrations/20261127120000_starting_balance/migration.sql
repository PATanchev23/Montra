-- A balance without a date is the starting balance: what was in the bank before
-- the first transaction. A date still needs a balance to belong to.
ALTER TABLE "Business" DROP CONSTRAINT "Business_cash_balance_dated_check";

ALTER TABLE "Business" ADD CONSTRAINT "Business_cash_balance_date_check"
  CHECK ("cashBalanceDate" IS NULL OR "cashBalanceCents" IS NOT NULL);
