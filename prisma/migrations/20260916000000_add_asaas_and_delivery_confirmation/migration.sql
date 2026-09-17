-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "asaasPaymentId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "asaasPaymentStatus" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "asaasInvoiceUrl" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveredConfirmedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveredConfirmedBy" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Order_asaasPaymentId_key" ON "Order"("asaasPaymentId");

-- CreateTable
CREATE TABLE IF NOT EXISTS "PaymentWebhookEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentWebhookEvent_eventId_key" ON "PaymentWebhookEvent"("eventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentWebhookEvent_provider_eventType_idx" ON "PaymentWebhookEvent"("provider", "eventType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentWebhookEvent_processedAt_idx" ON "PaymentWebhookEvent"("processedAt");
