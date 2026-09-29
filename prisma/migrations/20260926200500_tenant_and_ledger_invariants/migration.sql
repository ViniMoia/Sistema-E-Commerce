BEGIN;

-- Composite user/tenant identity used by all central write paths. The unique
-- index is additive; it is also the referenced key for the new composite FKs.
CREATE UNIQUE INDEX IF NOT EXISTS "User_id_lojaID_key" ON "User"("id", "lojaID");

ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_userID_fkey";
ALTER TABLE "Product"
  ADD CONSTRAINT "Product_userID_lojaID_fkey"
  FOREIGN KEY ("userID", "lojaID") REFERENCES "User"("id", "lojaID")
  ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;

ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_userID_fkey";
ALTER TABLE "Order"
  ADD CONSTRAINT "Order_userID_lojaID_fkey"
  FOREIGN KEY ("userID", "lojaID") REFERENCES "User"("id", "lojaID")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

ALTER TABLE "LoyaltyWallet" DROP CONSTRAINT IF EXISTS "LoyaltyWallet_userID_fkey";
ALTER TABLE "LoyaltyWallet"
  ADD CONSTRAINT "LoyaltyWallet_userID_lojaID_fkey"
  FOREIGN KEY ("userID", "lojaID") REFERENCES "User"("id", "lojaID")
  ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;

ALTER TABLE "LoyaltyTransaction" DROP CONSTRAINT IF EXISTS "LoyaltyTransaction_userID_fkey";
ALTER TABLE "LoyaltyTransaction"
  ADD CONSTRAINT "LoyaltyTransaction_userID_lojaID_fkey"
  FOREIGN KEY ("userID", "lojaID") REFERENCES "User"("id", "lojaID")
  ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;

-- Historical rows remain inspectable. NOT VALID enforces every new/updated row
-- immediately; validation of legacy data is an explicit deployment step.
ALTER TABLE "Order"
  ADD CONSTRAINT "chk_order_points_non_negative"
    CHECK ("pointsEarned" >= 0 AND "pointsRedeemed" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_order_discount_domain"
    CHECK ("pointsDiscountValue" >= 0 AND "pointsDiscountValue" <= "subtotal") NOT VALID,
  ADD CONSTRAINT "chk_order_total_equation"
    CHECK ("total" = "subtotal" - "pointsDiscountValue" + "shippingCost") NOT VALID,
  ADD CONSTRAINT "chk_order_installments_domain"
    CHECK ("installments" IS NULL OR ("installments" BETWEEN 1 AND 12)) NOT VALID,
  ADD CONSTRAINT "chk_order_installment_value_positive"
    CHECK ("installmentValue" IS NULL OR "installmentValue" > 0) NOT VALID;

ALTER TABLE "LoyaltyWallet"
  ADD CONSTRAINT "chk_loyalty_wallet_non_negative"
    CHECK ("balance" >= 0 AND "pending" >= 0 AND "lifetimeEarn" >= 0 AND "version" >= 0) NOT VALID;

ALTER TABLE "LoyaltyTransaction"
  ADD COLUMN IF NOT EXISTS "operationKey" TEXT,
  ADD CONSTRAINT "chk_loyalty_transaction_sign"
    CHECK (
      ("type" IN ('EARN', 'REFUND_REDEEM') AND "points" > 0)
      OR ("type" IN ('REDEEM', 'REFUND_EARN', 'EXPIRATION') AND "points" < 0)
      OR ("type" = 'ADMIN_ADJUSTMENT' AND "points" <> 0)
    ) NOT VALID,
  ADD CONSTRAINT "chk_loyalty_transaction_balance_non_negative"
    CHECK ("balanceAfter" >= 0) NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS "LoyaltyTransaction_operationKey_key"
  ON "LoyaltyTransaction"("operationKey");

COMMIT;
