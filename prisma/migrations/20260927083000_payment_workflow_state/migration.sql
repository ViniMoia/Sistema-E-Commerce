CREATE TYPE "PaymentWorkflowStatus" AS ENUM (
  'NOT_REQUIRED',
  'PROCESSING',
  'AWAITING_PAYMENT',
  'CONFIRMED',
  'DECLINED',
  'RECONCILIATION_REQUIRED',
  'REFUNDED'
);

ALTER TABLE "Order"
  ADD COLUMN "checkoutFingerprint" TEXT,
  ADD COLUMN "pixQrCode" TEXT,
  ADD COLUMN "pixPayload" TEXT,
  ADD COLUMN "paymentFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "paymentWorkflowStatus" "PaymentWorkflowStatus" NOT NULL DEFAULT 'PROCESSING',
  ADD COLUMN "paymentAttemptedAt" TIMESTAMP(3),
  ADD COLUMN "paymentLastError" TEXT,
  ADD COLUMN "paymentReconciledAt" TIMESTAMP(3);

UPDATE "Order"
SET "paymentWorkflowStatus" = CASE
  WHEN "paymentMethod" = 'WHATSAPP_PIX' THEN 'NOT_REQUIRED'::"PaymentWorkflowStatus"
  WHEN "asaasPaymentStatus" = 'REFUNDED' THEN 'REFUNDED'::"PaymentWorkflowStatus"
  WHEN "status" IN ('PAID', 'SHIPPED', 'DELIVERED')
    OR "asaasPaymentStatus" IN ('RECEIVED', 'CONFIRMED')
    THEN 'CONFIRMED'::"PaymentWorkflowStatus"
  WHEN "asaasPaymentId" IS NOT NULL THEN 'AWAITING_PAYMENT'::"PaymentWorkflowStatus"
  WHEN "status" = 'CANCELLED' THEN 'DECLINED'::"PaymentWorkflowStatus"
  ELSE 'RECONCILIATION_REQUIRED'::"PaymentWorkflowStatus"
END;

CREATE INDEX "Order_lojaID_paymentWorkflowStatus_updatedAt_idx"
  ON "Order"("lojaID", "paymentWorkflowStatus", "updatedAt");

ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "chk_order_total_equation";
ALTER TABLE "Order"
  ADD CONSTRAINT "chk_order_total_equation"
  CHECK (
    "total" = "subtotal" - "pointsDiscountValue" + "shippingCost" + "paymentFee"
  ) NOT VALID;
