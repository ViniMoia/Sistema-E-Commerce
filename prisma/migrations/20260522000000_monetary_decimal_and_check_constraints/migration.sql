-- ==============================================================================
-- Migration: 20260522000000_monetary_decimal_and_check_constraints
-- Finding DB-003: Padronização de tipos monetários para Decimal(10,2) e Constraints CHECK
-- ==============================================================================

-- 1. Alterar colunas de Float/Double Precision para Decimal(10,2)
ALTER TABLE "Product" ALTER COLUMN "price" TYPE DECIMAL(10,2) USING "price"::numeric(10,2);

ALTER TABLE "Cart" ALTER COLUMN "shippingCost" TYPE DECIMAL(10,2) USING "shippingCost"::numeric(10,2);

ALTER TABLE "CartItem" ALTER COLUMN "price" TYPE DECIMAL(10,2) USING "price"::numeric(10,2);

ALTER TABLE "FreightRule" ALTER COLUMN "value" TYPE DECIMAL(10,2) USING "value"::numeric(10,2);

ALTER TABLE "Order" ALTER COLUMN "freightValue" TYPE DECIMAL(10,2) USING "freightValue"::numeric(10,2);

-- 2. Adicionar Constraints CHECK de não-negatividade e integridade de domínio
DO $$
BEGIN
    -- Product
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_product_price_non_negative') THEN
        ALTER TABLE "Product" ADD CONSTRAINT "chk_product_price_non_negative" CHECK ("price" >= 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_product_stock_non_negative') THEN
        ALTER TABLE "Product" ADD CONSTRAINT "chk_product_stock_non_negative" CHECK ("stock" >= 0);
    END IF;

    -- ProductVariants
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_variant_stock_non_negative') THEN
        ALTER TABLE "ProductVariants" ADD CONSTRAINT "chk_variant_stock_non_negative" CHECK ("stock" >= 0);
    END IF;

    -- CartItem
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cartitem_quantity_positive') THEN
        ALTER TABLE "CartItem" ADD CONSTRAINT "chk_cartitem_quantity_positive" CHECK ("quantity" > 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cartitem_price_non_negative') THEN
        ALTER TABLE "CartItem" ADD CONSTRAINT "chk_cartitem_price_non_negative" CHECK ("price" >= 0);
    END IF;

    -- Order
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_order_total_non_negative') THEN
        ALTER TABLE "Order" ADD CONSTRAINT "chk_order_total_non_negative" CHECK ("total" >= 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_order_subtotal_non_negative') THEN
        ALTER TABLE "Order" ADD CONSTRAINT "chk_order_subtotal_non_negative" CHECK ("subtotal" >= 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_order_shipping_non_negative') THEN
        ALTER TABLE "Order" ADD CONSTRAINT "chk_order_shipping_non_negative" CHECK ("shippingCost" >= 0);
    END IF;

    -- OrderItem
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_orderitem_quantity_positive') THEN
        ALTER TABLE "OrderItem" ADD CONSTRAINT "chk_orderitem_quantity_positive" CHECK ("quantity" > 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_orderitem_price_non_negative') THEN
        ALTER TABLE "OrderItem" ADD CONSTRAINT "chk_orderitem_price_non_negative" CHECK ("price" >= 0);
    END IF;

    -- FreightRule
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_freightrule_value_non_negative') THEN
        ALTER TABLE "FreightRule" ADD CONSTRAINT "chk_freightrule_value_non_negative" CHECK ("value" >= 0);
    END IF;
END $$;
