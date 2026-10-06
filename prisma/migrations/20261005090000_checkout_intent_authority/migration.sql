-- Additive protocol: historical orders/intents are not assigned a source/owner.
CREATE TABLE "CheckoutBasket" (
  "id" TEXT NOT NULL, "lojaID" TEXT NOT NULL, "ownerKey" VARCHAR(128) NOT NULL, "generation" INTEGER NOT NULL DEFAULT 0,
  "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CheckoutBasket_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CheckoutBasket_id_lojaID_key" ON "CheckoutBasket"("id","lojaID");
CREATE UNIQUE INDEX "CheckoutBasket_lojaID_ownerKey_generation_key" ON "CheckoutBasket"("lojaID","ownerKey","generation");
CREATE INDEX "CheckoutBasket_lojaID_ownerKey_createdAt_idx" ON "CheckoutBasket"("lojaID","ownerKey","createdAt");
CREATE UNIQUE INDEX "CheckoutBasket_active_owner_key" ON "CheckoutBasket"("lojaID","ownerKey") WHERE "status"='ACTIVE';
ALTER TABLE "CheckoutBasket" ADD CONSTRAINT "CheckoutBasket_lojaID_fkey" FOREIGN KEY ("lojaID") REFERENCES "Loja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CheckoutIntent" ADD COLUMN "basketID" TEXT, ADD COLUMN "protocolVersion" INTEGER;
ALTER TABLE "CheckoutIntent" DROP CONSTRAINT "CheckoutIntent_cartID_fkey";
ALTER TABLE "CheckoutIntent" ADD CONSTRAINT "CheckoutIntent_cartID_lojaID_fkey" FOREIGN KEY ("cartID","lojaID") REFERENCES "Cart"("id","lojaID") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "CheckoutIntent_basketID_key" ON "CheckoutIntent"("basketID");
ALTER TABLE "CheckoutIntent" ADD CONSTRAINT "CheckoutIntent_basketID_lojaID_fkey" FOREIGN KEY ("basketID","lojaID") REFERENCES "CheckoutBasket"("id","lojaID") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CheckoutIntent" ADD CONSTRAINT "chk_checkout_intent_source" CHECK (
  "protocolVersion" IS NULL OR ("protocolVersion"=1 AND "revision">=1 AND
    (CASE WHEN "cartID" IS NULL THEN 0 ELSE 1 END + CASE WHEN "basketID" IS NULL THEN 0 ELSE 1 END)=1 AND
    ("cartID" IS NULL OR ("cartVersion" IS NOT NULL AND "cartVersion">=0)) AND
    (("cartID" IS NOT NULL AND "userID" IS NOT NULL) OR ("basketID" IS NOT NULL AND "userID" IS NULL AND "ownerKey" ~ '^g:[a-f0-9]{64}$')))) NOT VALID;
ALTER TABLE "CheckoutIntent" VALIDATE CONSTRAINT "chk_checkout_intent_source";
ALTER TABLE "Order" ADD COLUMN "sourceCartID" TEXT;
CREATE UNIQUE INDEX "Order_sourceCartID_key" ON "Order"("sourceCartID");
CREATE UNIQUE INDEX "Order_sourceCartID_lojaID_key" ON "Order"("sourceCartID","lojaID");
ALTER TABLE "Order" ADD CONSTRAINT "Order_sourceCartID_lojaID_fkey" FOREIGN KEY ("sourceCartID","lojaID") REFERENCES "Cart"("id","lojaID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enforce new reservation provenance at the write boundary, without backfilling
-- historical stock movements or declaring old orders to have reserved stock.
CREATE FUNCTION check_inventory_reservation_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "OrderItem" i JOIN "Order" o ON o.id=i."orderId"
    JOIN "Product" p ON p.id=i."productId"
    WHERE i.id=NEW."orderItemId" AND i."orderId"=NEW."orderId" AND i."productId"=NEW."productId"
      AND i."productVariantsId" IS NOT DISTINCT FROM NEW."variantId" AND i.quantity=NEW.quantity AND p."lojaID"=o."lojaID") THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATION_SOURCE_INVALID' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER inventory_reservation_source BEFORE INSERT OR UPDATE ON "InventoryReservation"
  FOR EACH ROW EXECUTE FUNCTION check_inventory_reservation_source();

CREATE FUNCTION check_checkout_commit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE o "Order"%ROWTYPE; i "CheckoutIntent"%ROWTYPE;
BEGIN
  SELECT * INTO o FROM "Order" WHERE id=NEW.id;
  SELECT * INTO i FROM "CheckoutIntent" WHERE id=o."checkoutIntentID";
  IF i."protocolVersion" IS DISTINCT FROM 1 THEN RETURN NULL; END IF;
  IF o."lojaID"<>i."lojaID" OR o."userID" IS DISTINCT FROM i."userID" OR o."buyerID" IS DISTINCT FROM i."buyerID"
    OR o."sourceCartID" IS DISTINCT FROM i."cartID" OR i."acceptedAt" IS NULL
    OR o."financialPlan" IS NULL OR o."financialTotal" IS NULL OR o."paymentMethod" IS NULL
    OR (SELECT count(*) FROM "PaymentAttempt" WHERE "orderId"=o.id)<>1
    OR NOT EXISTS (SELECT 1 FROM "OrderItem" WHERE "orderId"=o.id)
    OR (SELECT count(*) FROM "InventoryReservation" WHERE "orderId"=o.id)<>(SELECT count(*) FROM "OrderItem" WHERE "orderId"=o.id)
    OR (i."cartID" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Cart" c WHERE c.id=i."cartID" AND c."lojaID"=i."lojaID" AND c."userID"=i."userID" AND c.status='COMPLETED' AND c.version=i."cartVersion"+1))
    OR (i."basketID" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "CheckoutBasket" b WHERE b.id=i."basketID" AND b."lojaID"=i."lojaID" AND b."ownerKey"=i."ownerKey" AND b.status='COMPLETED')) THEN
    RAISE EXCEPTION 'CHECKOUT_COMMIT_INCOMPLETE' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER checkout_commit_complete AFTER INSERT ON "Order"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_checkout_commit();

CREATE FUNCTION keep_checkout_intent_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."protocolVersion"=1 AND EXISTS (SELECT 1 FROM "Order" WHERE "checkoutIntentID"=OLD.id) AND
    (NEW.snapshot,NEW."contentHash",NEW.revision,NEW."ownerKey",NEW."userID",NEW."lojaID",NEW."cartID",NEW."cartVersion",NEW."basketID",NEW."protocolVersion")
      IS DISTINCT FROM
    (OLD.snapshot,OLD."contentHash",OLD.revision,OLD."ownerKey",OLD."userID",OLD."lojaID",OLD."cartID",OLD."cartVersion",OLD."basketID",OLD."protocolVersion") THEN
    RAISE EXCEPTION 'CHECKOUT_ACCEPTED_CONTENT_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER checkout_intent_immutable BEFORE UPDATE ON "CheckoutIntent" FOR EACH ROW EXECUTE FUNCTION keep_checkout_intent_immutable();

CREATE FUNCTION keep_checkout_source_consumed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status='COMPLETED' AND NEW.status<>'COMPLETED' THEN
    RAISE EXCEPTION 'CHECKOUT_SOURCE_ALREADY_CONSUMED' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER checkout_cart_consumed BEFORE UPDATE ON "Cart" FOR EACH ROW EXECUTE FUNCTION keep_checkout_source_consumed();
CREATE TRIGGER checkout_basket_consumed BEFORE UPDATE ON "CheckoutBasket" FOR EACH ROW EXECUTE FUNCTION keep_checkout_source_consumed();
