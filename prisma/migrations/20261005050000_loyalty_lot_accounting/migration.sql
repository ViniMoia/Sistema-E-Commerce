-- Expansion only. No historical balance, ledger or expiry is inferred/backfilled.
ALTER TABLE "LoyaltyWallet" ADD COLUMN "accountingReady" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LoyaltyWallet" ADD COLUMN "expirationLeaseOwner" TEXT, ADD COLUMN "expirationLeaseUntil" TIMESTAMP(3);
ALTER TABLE "LoyaltyWallet" ADD CONSTRAINT "chk_wallet_expiration_lease"
  CHECK (("expirationLeaseOwner" IS NULL) = ("expirationLeaseUntil" IS NULL));
ALTER TABLE "LoyaltyTransaction"
  ADD COLUMN "contentHash" TEXT,
  ADD COLUMN "availableDelta" INTEGER,
  ADD COLUMN "debtDelta" INTEGER,
  ADD COLUMN "debtAfter" INTEGER,
  ADD COLUMN "policy" JSONB;
ALTER TABLE "LoyaltyLot" ADD COLUMN "originTransactionId" TEXT;
CREATE INDEX "LoyaltyLot_originTransactionId_idx" ON "LoyaltyLot"("originTransactionId");
ALTER TABLE "LoyaltyLot" ADD CONSTRAINT "LoyaltyLot_originTransactionId_fkey"
  FOREIGN KEY ("originTransactionId") REFERENCES "LoyaltyTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Scoped to reconciled/new wallets: historical negatives are neither clamped nor erased.
ALTER TABLE "LoyaltyWallet" ADD CONSTRAINT "chk_wallet_ready_balance"
  CHECK (NOT "accountingReady" OR (balance >= 0 AND (debt = 0 OR balance = 0)));
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "chk_loyalty_accounting_effect"
  CHECK (("availableDelta" IS NULL AND "debtDelta" IS NULL AND "debtAfter" IS NULL)
    OR ("availableDelta" IS NOT NULL AND "debtDelta" IS NOT NULL AND "debtAfter" IS NOT NULL
      AND "debtAfter" >= 0 AND "balanceAfter" >= 0 AND "effectKey" IS NOT NULL
      AND "contentHash" IS NOT NULL AND policy IS NOT NULL
      AND points = "availableDelta" - "debtDelta"));
