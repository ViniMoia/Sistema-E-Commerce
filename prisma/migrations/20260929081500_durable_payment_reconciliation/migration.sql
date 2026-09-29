-- Referência estável persistida antes da chamada externa. Registros existentes
-- usavam Order.id como externalReference, portanto o backfill preserva esse contrato.
ALTER TABLE "Order" ADD COLUMN "paymentReference" TEXT;
UPDATE "Order" SET "paymentReference" = "id" WHERE "paymentReference" IS NULL;
ALTER TABLE "Order" ALTER COLUMN "paymentReference" SET NOT NULL;
CREATE UNIQUE INDEX "Order_paymentReference_key" ON "Order"("paymentReference");

CREATE TYPE "PaymentReconciliationStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'RETRY_SCHEDULED',
  'RESOLVED',
  'MANUAL_REVIEW',
  'DEAD_LETTER'
);

CREATE TABLE "PaymentReconciliation" (
  "id" TEXT NOT NULL,
  "orderID" TEXT NOT NULL,
  "paymentReference" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'ASAAS',
  "status" "PaymentReconciliationStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 8,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastAttemptAt" TIMESTAMP(3),
  "lockedAt" TIMESTAMP(3),
  "leaseOwner" TEXT,
  "gatewayPaymentId" TEXT,
  "gatewayStatus" TEXT,
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentReconciliation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentReconciliation_orderID_key"
  ON "PaymentReconciliation"("orderID");
CREATE UNIQUE INDEX "PaymentReconciliation_paymentReference_key"
  ON "PaymentReconciliation"("paymentReference");
CREATE INDEX "PaymentReconciliation_status_nextAttemptAt_idx"
  ON "PaymentReconciliation"("status", "nextAttemptAt");
CREATE INDEX "PaymentReconciliation_status_lockedAt_idx"
  ON "PaymentReconciliation"("status", "lockedAt");
CREATE INDEX "PaymentReconciliation_firstDetectedAt_idx"
  ON "PaymentReconciliation"("firstDetectedAt");

ALTER TABLE "PaymentReconciliation"
  ADD CONSTRAINT "PaymentReconciliation_orderID_fkey"
  FOREIGN KEY ("orderID") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Intents automáticos que já estavam ambíguos antes desta migração entram na fila.
INSERT INTO "PaymentReconciliation" (
  "id", "orderID", "paymentReference", "status", "attempts", "maxAttempts",
  "nextAttemptAt", "firstDetectedAt", "createdAt", "updatedAt"
)
SELECT
  'legacy-' || "id", "id", "paymentReference", 'PENDING', 0, 8,
  CURRENT_TIMESTAMP, COALESCE("paymentAttemptedAt", "createdAt"),
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Order"
WHERE "paymentWorkflowStatus" IN ('PROCESSING', 'RECONCILIATION_REQUIRED')
  AND "paymentMethod" IN ('PIX', 'CREDIT_CARD', 'BOLETO')
ON CONFLICT ("orderID") DO NOTHING;
