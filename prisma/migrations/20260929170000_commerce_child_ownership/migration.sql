-- DB-006: enforce ownership without adding client-supplied tenant fields.
-- Existing inconsistent rows abort the entire migration; no data is rewritten.
BEGIN;
LOCK TABLE "User", "Product", "ProductVariants", "Cart", "CartItem", "Address", "Order", "OrderItem" IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "CartItem" i JOIN "Cart" c ON c.id=i."cartID" JOIN "User" u ON u.id=c."userID"
    JOIN "Product" p ON p.id=i."productID" JOIN "ProductVariants" v ON v.id=i."variantID"
    WHERE u."lojaID"<>p."lojaID" OR v."ProductID"<>p.id)
  OR EXISTS (SELECT 1 FROM "OrderItem" i JOIN "Order" o ON o.id=i."orderId"
    LEFT JOIN "ProductVariants" v ON v.id=i."productVariantsId"
    JOIN "Product" p ON p.id=COALESCE(i."productId",v."ProductID")
    WHERE o."lojaID"<>p."lojaID" OR (v.id IS NOT NULL AND i."productId" IS NOT NULL AND v."ProductID"<>p.id))
  OR EXISTS (SELECT 1 FROM "Order" o LEFT JOIN "Address" a ON a.id=o."addressID"
    LEFT JOIN "Cart" c ON c.id=o."sourceCartID"
    WHERE (a.id IS NOT NULL AND a."userID"<>o."userID") OR (c.id IS NOT NULL AND c."userID"<>o."userID"))
  OR EXISTS (SELECT 1 FROM "User" u JOIN "Address" a ON a.id=u."defaultAddressId" WHERE a."userID"<>u.id)
  THEN RAISE EXCEPTION 'COMMERCE_TENANT_PREFLIGHT_FAILED: repair approved data in a separate reviewed operation' USING ERRCODE='23514';
  END IF;
END $$;

CREATE FUNCTION enforce_commerce_child_ownership() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_id text; tenant_id text; product_tenant text; variant_product text; related_owner text; product_id text; variant_id text;
BEGIN
  IF TG_TABLE_NAME='CartItem' THEN
    product_id := NEW."productID"; variant_id := NEW."variantID";
    SELECT c."userID",u."lojaID" INTO owner_id,tenant_id FROM "Cart" c JOIN "User" u ON u.id=c."userID"
      WHERE c.id=NEW."cartID" FOR SHARE OF c,u;
  ELSIF TG_TABLE_NAME='OrderItem' THEN
    product_id := NEW."productId"; variant_id := NEW."productVariantsId";
    SELECT o."userID",o."lojaID" INTO owner_id,tenant_id FROM "Order" o WHERE o.id=NEW."orderId" FOR SHARE;
  END IF;
  IF TG_TABLE_NAME IN ('CartItem','OrderItem') THEN
    IF variant_id IS NOT NULL THEN
      SELECT "ProductID" INTO variant_product FROM "ProductVariants" WHERE id=variant_id FOR SHARE;
      IF product_id IS NOT NULL AND variant_product IS DISTINCT FROM product_id THEN
        RAISE EXCEPTION 'COMMERCE_VARIANT_MISMATCH' USING ERRCODE='23514';
      END IF;
    END IF;
    IF COALESCE(product_id,variant_product) IS NOT NULL THEN
      SELECT "lojaID" INTO product_tenant FROM "Product" WHERE id=COALESCE(product_id,variant_product) FOR SHARE;
      IF tenant_id IS DISTINCT FROM product_tenant THEN
        RAISE EXCEPTION 'COMMERCE_TENANT_MISMATCH' USING ERRCODE='23514';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME='Order' THEN
    IF NEW."addressID" IS NOT NULL THEN
      SELECT "userID" INTO related_owner FROM "Address" WHERE id=NEW."addressID" FOR SHARE;
      IF related_owner IS DISTINCT FROM NEW."userID" THEN RAISE EXCEPTION 'ORDER_ADDRESS_OWNER_MISMATCH' USING ERRCODE='23514'; END IF;
    END IF;
    IF NEW."sourceCartID" IS NOT NULL THEN
      SELECT "userID" INTO related_owner FROM "Cart" WHERE id=NEW."sourceCartID" FOR SHARE;
      IF related_owner IS DISTINCT FROM NEW."userID" THEN RAISE EXCEPTION 'ORDER_CART_OWNER_MISMATCH' USING ERRCODE='23514'; END IF;
    END IF;
    IF TG_OP='UPDATE' AND NEW."lojaID" IS DISTINCT FROM OLD."lojaID" AND EXISTS (SELECT 1 FROM "OrderItem" WHERE "orderId"=NEW.id) THEN
      RAISE EXCEPTION 'ORDER_TENANT_IMMUTABLE_WITH_ITEMS' USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME='User' AND NEW."defaultAddressId" IS NOT NULL THEN
    SELECT "userID" INTO related_owner FROM "Address" WHERE id=NEW."defaultAddressId" FOR SHARE;
    IF related_owner IS DISTINCT FROM NEW.id THEN RAISE EXCEPTION 'DEFAULT_ADDRESS_OWNER_MISMATCH' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER cart_item_ownership BEFORE INSERT OR UPDATE OF "cartID","productID","variantID" ON "CartItem"
  FOR EACH ROW EXECUTE FUNCTION enforce_commerce_child_ownership();
CREATE TRIGGER order_item_ownership BEFORE INSERT OR UPDATE OF "orderId","productId","productVariantsId" ON "OrderItem"
  FOR EACH ROW EXECUTE FUNCTION enforce_commerce_child_ownership();
CREATE TRIGGER order_owner_links BEFORE INSERT OR UPDATE OF "userID","lojaID","addressID","sourceCartID" ON "Order"
  FOR EACH ROW EXECUTE FUNCTION enforce_commerce_child_ownership();
CREATE TRIGGER default_address_owner BEFORE INSERT OR UPDATE OF "defaultAddressId" ON "User"
  FOR EACH ROW EXECUTE FUNCTION enforce_commerce_child_ownership();

-- Reparenting a referenced object must not bypass the child checks.
-- Child inserts take SHARE locks on these parents, serializing concurrent reparenting.
CREATE FUNCTION prevent_referenced_commerce_reparenting() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME='Product' THEN
    IF NEW."lojaID" IS DISTINCT FROM OLD."lojaID" AND
      (EXISTS (SELECT 1 FROM "CartItem" WHERE "productID"=OLD.id) OR EXISTS (SELECT 1 FROM "OrderItem" i LEFT JOIN "ProductVariants" v ON v.id=i."productVariantsId" WHERE i."productId"=OLD.id OR v."ProductID"=OLD.id)) THEN
      RAISE EXCEPTION 'REFERENCED_PRODUCT_TENANT_IMMUTABLE' USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME='ProductVariants' THEN
    IF NEW."ProductID" IS DISTINCT FROM OLD."ProductID" AND
      (EXISTS (SELECT 1 FROM "CartItem" WHERE "variantID"=OLD.id) OR EXISTS (SELECT 1 FROM "OrderItem" WHERE "productVariantsId"=OLD.id)) THEN
      RAISE EXCEPTION 'REFERENCED_VARIANT_PRODUCT_IMMUTABLE' USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME='Cart' THEN
    IF NEW."userID" IS DISTINCT FROM OLD."userID" AND
      (EXISTS (SELECT 1 FROM "CartItem" WHERE "cartID"=OLD.id) OR EXISTS (SELECT 1 FROM "Order" WHERE "sourceCartID"=OLD.id)) THEN
      RAISE EXCEPTION 'REFERENCED_CART_OWNER_IMMUTABLE' USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME='Address' THEN
    IF NEW."userID" IS DISTINCT FROM OLD."userID" AND
      (EXISTS (SELECT 1 FROM "Order" WHERE "addressID"=OLD.id) OR EXISTS (SELECT 1 FROM "User" WHERE "defaultAddressId"=OLD.id)) THEN
      RAISE EXCEPTION 'REFERENCED_ADDRESS_OWNER_IMMUTABLE' USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME='User' THEN
    IF NEW."lojaID" IS DISTINCT FROM OLD."lojaID" AND EXISTS
      (SELECT 1 FROM "Cart" c JOIN "CartItem" i ON i."cartID"=c.id WHERE c."userID"=OLD.id) THEN
      RAISE EXCEPTION 'REFERENCED_CART_TENANT_IMMUTABLE' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER product_tenant_reparent BEFORE UPDATE OF "lojaID" ON "Product" FOR EACH ROW EXECUTE FUNCTION prevent_referenced_commerce_reparenting();
CREATE TRIGGER variant_product_reparent BEFORE UPDATE OF "ProductID" ON "ProductVariants" FOR EACH ROW EXECUTE FUNCTION prevent_referenced_commerce_reparenting();
CREATE TRIGGER cart_owner_reparent BEFORE UPDATE OF "userID" ON "Cart" FOR EACH ROW EXECUTE FUNCTION prevent_referenced_commerce_reparenting();
CREATE TRIGGER address_owner_reparent BEFORE UPDATE OF "userID" ON "Address" FOR EACH ROW EXECUTE FUNCTION prevent_referenced_commerce_reparenting();
CREATE TRIGGER user_tenant_reparent BEFORE UPDATE OF "lojaID" ON "User" FOR EACH ROW EXECUTE FUNCTION prevent_referenced_commerce_reparenting();
COMMIT;
