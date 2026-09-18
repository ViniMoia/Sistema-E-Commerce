-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_lojaID_status_paidAt_idx" ON "Order"("lojaID", "status", "paidAt");
