BEGIN;
SET LOCAL lock_timeout = '10s';
ALTER TABLE "Order" ALTER COLUMN "userID" DROP NOT NULL;
ALTER TABLE "Order" ADD CONSTRAINT "Order_owner_shape_check" CHECK ("userID" IS NOT NULL OR "buyerID" IS NOT NULL);
COMMIT;
