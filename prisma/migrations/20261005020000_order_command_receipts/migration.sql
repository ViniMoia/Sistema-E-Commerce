BEGIN;
SET LOCAL lock_timeout = '10s';

ALTER TABLE "OrderStatusHistory" ADD COLUMN "commandContentHash" VARCHAR(64);
ALTER TABLE "OrderStatusHistory" ADD COLUMN "orderVersion" INTEGER;
CREATE UNIQUE INDEX "OrderStatusHistory_orderId_orderVersion_key" ON "OrderStatusHistory"("orderId", "orderVersion");
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_order_version_check" CHECK (
  "orderVersion" IS NULL OR "orderVersion" > 0
);
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_command_receipt_check" CHECK (
  ("commandKey" IS NULL AND "commandContentHash" IS NULL)
  OR ("commandKey" IS NOT NULL AND "commandContentHash" IS NOT NULL
    AND "commandContentHash" ~ '^[a-f0-9]{64}$')
);

COMMIT;
