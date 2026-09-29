BEGIN;

-- Existing rows were inserted by the legacy handler before effects ran, but there
-- is no reliable way to distinguish completed from interrupted historical rows.
-- Preserve their former meaning as PROCESSED and use the inbox lifecycle only for
-- events received after this migration.
DO $$
BEGIN
  CREATE TYPE "WebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "PaymentWebhookEvent"
  ADD COLUMN IF NOT EXISTS "status" "WebhookEventStatus" NOT NULL DEFAULT 'PROCESSED',
  ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastError" TEXT,
  ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "PaymentWebhookEvent"
  ALTER COLUMN "processedAt" DROP NOT NULL,
  ALTER COLUMN "processedAt" DROP DEFAULT,
  ALTER COLUMN "updatedAt" DROP DEFAULT,
  ALTER COLUMN "status" SET DEFAULT 'RECEIVED';

CREATE INDEX IF NOT EXISTS "PaymentWebhookEvent_status_lockedAt_idx"
  ON "PaymentWebhookEvent"("status", "lockedAt");

COMMIT;
