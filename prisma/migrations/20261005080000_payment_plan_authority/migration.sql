BEGIN;
SET LOCAL lock_timeout = '10s';
ALTER TABLE "Loja" ADD COLUMN "enableManualPix" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "enablePix" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "enableCreditCard" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "enableBoleto" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "financialTotal" DECIMAL(10,2), ADD COLUMN "financingCharge" DECIMAL(10,2),
  ADD COLUMN "financialPlan" JSONB, ADD COLUMN "loyaltyEarnSnapshot" JSONB,
  ADD COLUMN "pointsCredited" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD CONSTRAINT "chk_order_financial_plan_values" CHECK (
  ("financialTotal" IS NULL AND "financingCharge" IS NULL AND "financialPlan" IS NULL) OR
  ("financialTotal" IS NOT NULL AND "financingCharge" IS NOT NULL AND "financialPlan" IS NOT NULL
    AND "financingCharge" >= 0 AND "financialTotal" = total + "financingCharge"));
ALTER TABLE "Order" ADD CONSTRAINT "chk_order_points_credited" CHECK ("pointsCredited" >= 0);
CREATE FUNCTION bump_payment_policy_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(OLD."enableManualPix",OLD."enablePix",OLD."enableCreditCard",OLD."enableBoleto",OLD."pixKey",OLD."whatsappNumber",
    OLD."loyaltyEnabled",OLD."loyaltyEarnRate",OLD."loyaltyPointValue",OLD."loyaltyMinPointsRedeem",OLD."loyaltyMaxDiscountPct",OLD."loyaltyPointsExpiryDays")
    IS DISTINCT FROM ROW(NEW."enableManualPix",NEW."enablePix",NEW."enableCreditCard",NEW."enableBoleto",NEW."pixKey",NEW."whatsappNumber",
    NEW."loyaltyEnabled",NEW."loyaltyEarnRate",NEW."loyaltyPointValue",NEW."loyaltyMinPointsRedeem",NEW."loyaltyMaxDiscountPct",NEW."loyaltyPointsExpiryDays") THEN
    NEW."configurationVersion" := OLD."configurationVersion" + 1;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payment_policy_revision BEFORE UPDATE ON "Loja" FOR EACH ROW EXECUTE FUNCTION bump_payment_policy_revision();
-- Legacy orders are not assigned fabricated plans, origins or received points.
COMMIT;
