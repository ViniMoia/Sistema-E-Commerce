BEGIN;
SET LOCAL lock_timeout = '10s';
-- Stop concurrent legacy writers before inspecting/backfilling ownership.
LOCK TABLE "User", "Cart", "CartItem", "Product", "ProductVariants", "Order", "OrderItem", "Address" IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM "CartItem" ci
    JOIN "Cart" c ON c.id=ci."cartID" JOIN "User" u ON u.id=c."userID"
    JOIN "Product" p ON p.id=ci."productID"
    JOIN "ProductVariants" v ON v.id=ci."variantID"
    WHERE p."lojaID"<>u."lojaID" OR v."ProductID"<>p.id
  ) OR EXISTS (
    SELECT 1 FROM "Order" o JOIN "User" u ON u.id=o."userID"
    WHERE o."lojaID"<>u."lojaID"
  ) OR EXISTS (
    SELECT 1 FROM "Order" o JOIN "Address" a ON a.id=o."addressID"
    WHERE a."userID"<>o."userID"
  ) OR EXISTS (
    SELECT 1 FROM "OrderItem" oi JOIN "Order" o ON o.id=oi."orderId"
    LEFT JOIN "Product" p ON p.id=oi."productId"
    LEFT JOIN "ProductVariants" v ON v.id=oi."productVariantsId"
    WHERE (p.id IS NOT NULL AND p."lojaID"<>o."lojaID")
      OR (v.id IS NOT NULL AND (p.id IS NULL OR v."ProductID"<>p.id))
  ) THEN
    RAISE EXCEPTION 'PURCHASE_TENANT_BACKFILL_BLOCKED: legacy purchase links require audited reconciliation; no data reassigned';
  END IF;
END $$;
ALTER TABLE "Cart" ADD COLUMN "lojaID" TEXT;
UPDATE "Cart" c SET "lojaID"=u."lojaID" FROM "User" u WHERE u.id=c."userID";
ALTER TABLE "Cart" ALTER COLUMN "lojaID" SET NOT NULL;
ALTER TABLE "CartItem" ADD COLUMN "lojaID" TEXT;
UPDATE "CartItem" ci SET "lojaID"=c."lojaID" FROM "Cart" c WHERE c.id=ci."cartID";
ALTER TABLE "CartItem" ALTER COLUMN "lojaID" SET NOT NULL;
ALTER TABLE "Cart" DROP CONSTRAINT "Cart_userID_fkey";
ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_cartID_fkey", DROP CONSTRAINT "CartItem_productID_fkey", DROP CONSTRAINT "CartItem_variantID_fkey";
ALTER TABLE "Order" DROP CONSTRAINT "Order_userID_fkey";
CREATE UNIQUE INDEX "Product_id_lojaID_key" ON "Product"(id,"lojaID");
CREATE UNIQUE INDEX "Cart_id_lojaID_key" ON "Cart"(id,"lojaID");
CREATE INDEX "Cart_lojaID_userID_status_idx" ON "Cart"("lojaID","userID",status);
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_lojaID_fkey" FOREIGN KEY ("lojaID") REFERENCES "Loja"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userID_lojaID_fkey" FOREIGN KEY ("userID","lojaID") REFERENCES "User"(id,"lojaID") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartID_lojaID_fkey" FOREIGN KEY ("cartID","lojaID") REFERENCES "Cart"(id,"lojaID") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productID_lojaID_fkey" FOREIGN KEY ("productID","lojaID") REFERENCES "Product"(id,"lojaID") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_variantID_productID_fkey" FOREIGN KEY ("variantID","productID") REFERENCES "ProductVariants"(id,"ProductID") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_userID_lojaID_fkey" FOREIGN KEY ("userID","lojaID") REFERENCES "User"(id,"lojaID") ON DELETE RESTRICT ON UPDATE CASCADE;
COMMIT;
