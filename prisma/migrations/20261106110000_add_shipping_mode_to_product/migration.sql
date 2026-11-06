-- Add shippingMode column to Product with safe default
BEGIN;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "shippingMode" TEXT NOT NULL DEFAULT 'AUTOMATIC';
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_shippingMode_check";
ALTER TABLE "Product" ADD CONSTRAINT "Product_shippingMode_check"
  CHECK ("shippingMode" IN ('AUTOMATIC', 'WHATSAPP_ONLY'));
COMMIT;
