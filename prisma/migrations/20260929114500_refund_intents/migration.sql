CREATE TYPE "RefundIntentStatus" AS ENUM (
  'REFUND_REQUESTED',
  'PROCESSING',
  'CONFIRMED',
  'FAILED',
  'RECONCILIATION_REQUIRED'
);

CREATE TYPE "RefundKind" AS ENUM ('FULL', 'PARTIAL');

ALTER TYPE "PaymentWorkflowStatus" ADD VALUE IF NOT EXISTS 'REFUND_PROCESSING';
ALTER TYPE "PaymentWorkflowStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_REFUNDED';

CREATE TABLE "RefundIntent" (
  "id" TEXT NOT NULL,
  "orderID" TEXT NOT NULL,
  "lojaID" TEXT NOT NULL,
  "operationKey" TEXT NOT NULL,
  "operationReference" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'ASAAS',
  "gatewayPaymentId" TEXT NOT NULL,
  "kind" "RefundKind" NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "status" "RefundIntentStatus" NOT NULL DEFAULT 'REFUND_REQUESTED',
  "providerStatus" TEXT,
  "requestedById" TEXT NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 8,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "gatewayCalledAt" TIMESTAMP(3),
  "lastAttemptAt" TIMESTAMP(3),
  "lockedAt" TIMESTAMP(3),
  "leaseOwner" TEXT,
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "effectAppliedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RefundIntent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RefundIntent_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "RefundIntent_attempts_nonnegative" CHECK ("attempts" >= 0),
  CONSTRAINT "RefundIntent_max_attempts_positive" CHECK ("maxAttempts" > 0)
);

CREATE UNIQUE INDEX "RefundIntent_operationKey_key" ON "RefundIntent"("operationKey");
CREATE UNIQUE INDEX "RefundIntent_operationReference_key" ON "RefundIntent"("operationReference");
CREATE INDEX "RefundIntent_orderID_status_idx" ON "RefundIntent"("orderID", "status");
CREATE INDEX "RefundIntent_lojaID_status_nextAttemptAt_idx" ON "RefundIntent"("lojaID", "status", "nextAttemptAt");
CREATE INDEX "RefundIntent_status_nextAttemptAt_idx" ON "RefundIntent"("status", "nextAttemptAt");
CREATE INDEX "RefundIntent_status_lockedAt_idx" ON "RefundIntent"("status", "lockedAt");
CREATE INDEX "RefundIntent_createdAt_idx" ON "RefundIntent"("createdAt");

ALTER TABLE "RefundIntent"
  ADD CONSTRAINT "RefundIntent_orderID_fkey"
  FOREIGN KEY ("orderID") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
