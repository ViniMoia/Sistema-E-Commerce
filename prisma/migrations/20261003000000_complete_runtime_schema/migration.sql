-- LA-030: complete missing runtime schema; preserve existing monetary precision,
-- CHECK constraints and performance indexes. Old migrations remain untouched.
-- Existing manually synchronized objects are accepted only after catalog/diff review.
-- Rehearse on a restored clone before applying to any persistent database.
BEGIN;
SET LOCAL lock_timeout = '10s';

-- CreateEnum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SyncStatus' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'PROCESSING', 'SYNCED', 'FAILED', 'DEAD_LETTER');
  END IF;
END $$;

-- AlterEnum
ALTER TYPE "DeliveryType" ADD VALUE IF NOT EXISTS 'NONE';

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_addressID_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_productId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "OrderItem_orderId_productId_key";

-- DropIndex
DROP INDEX IF EXISTS "User_email_key";

-- AlterTable

-- Never silently round historical freight values when reconciling a clone
-- synchronized through db push. Diagnose incompatible values before conversion.
LOCK TABLE "Cart", "FreightRule", "Order" IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "Cart" WHERE "shippingCost"::numeric <> round("shippingCost"::numeric, 2)
    OR abs("shippingCost"::numeric) >= 100000000)
    OR EXISTS (SELECT 1 FROM "FreightRule" WHERE "value" <> round("value", 2) OR abs("value") >= 100000000)
    OR EXISTS (SELECT 1 FROM "Order" WHERE "freightValue" <> round("freightValue", 2) OR abs("freightValue") >= 100000000) THEN
    RAISE EXCEPTION 'LA-030: incompatible legacy monetary values; audit and rehearse before migration';
  END IF;
END $$;
ALTER TABLE "Cart" ALTER COLUMN "shippingCost" TYPE DECIMAL(10,2) USING "shippingCost"::numeric(10,2);
ALTER TABLE "FreightRule" ALTER COLUMN "value" TYPE DECIMAL(10,2) USING "value"::numeric(10,2);
ALTER TABLE "Loja" ADD COLUMN IF NOT EXISTS "additionalDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "correiosContractCode" TEXT,
ADD COLUMN IF NOT EXISTS "correiosPassword" TEXT,
ADD COLUMN IF NOT EXISTS "enableCorreios" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "enableNoFreight" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "enablePickup" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "nuvemshopAccessToken" TEXT,
ADD COLUMN IF NOT EXISTS "nuvemshopStoreId" TEXT,
ADD COLUMN IF NOT EXISTS "nuvemshopUserAgent" TEXT,
ADD COLUMN IF NOT EXISTS "originCep" TEXT,
ADD COLUMN IF NOT EXISTS "originCity" TEXT,
ADD COLUMN IF NOT EXISTS "originComplement" TEXT,
ADD COLUMN IF NOT EXISTS "originDistrict" TEXT,
ADD COLUMN IF NOT EXISTS "originNumber" TEXT,
ADD COLUMN IF NOT EXISTS "originState" TEXT,
ADD COLUMN IF NOT EXISTS "originStreet" TEXT;

-- AlterTable
ALTER TABLE "LoyaltyWallet" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "asaasBankSlipUrl" TEXT,
ADD COLUMN IF NOT EXISTS "asaasBarCode" TEXT,
ADD COLUMN IF NOT EXISTS "asaasDigitableLine" TEXT,
ADD COLUMN IF NOT EXISTS "asaasDueDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "creditCardBrand" TEXT,
ADD COLUMN IF NOT EXISTS "creditCardLast4" TEXT,
ADD COLUMN IF NOT EXISTS "installmentValue" DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS "installments" INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS "lastSyncError" TEXT,
ADD COLUMN IF NOT EXISTS "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "nuvemshopOrderId" TEXT,
ADD COLUMN IF NOT EXISTS "shippingEstimatedDays" INTEGER,
ADD COLUMN IF NOT EXISTS "shippingProvider" TEXT,
ADD COLUMN IF NOT EXISTS "shippingServiceName" TEXT,
ADD COLUMN IF NOT EXISTS "syncAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "syncStatus" "SyncStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "addressID" DROP NOT NULL,
ALTER COLUMN "freightValue" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "OrderItem" ALTER COLUMN "productId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "brandID" TEXT,
ADD COLUMN IF NOT EXISTS "freeShipping" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "heightCm" INTEGER DEFAULT 4,
ADD COLUMN IF NOT EXISTS "lengthCm" INTEGER DEFAULT 16,
ADD COLUMN IF NOT EXISTS "nuvemshopProductId" TEXT,
ADD COLUMN IF NOT EXISTS "sku" TEXT,
ADD COLUMN IF NOT EXISTS "stockBuffer" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "tagsSearchCache" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "weightInGrams" INTEGER DEFAULT 300,
ADD COLUMN IF NOT EXISTS "widthCm" INTEGER DEFAULT 11;

-- AlterTable
ALTER TABLE "ProductVariants" ADD COLUMN IF NOT EXISTS "nuvemshopVariantId" TEXT,
ADD COLUMN IF NOT EXISTS "sku" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "StockSyncLog" (
    "id" TEXT NOT NULL,
    "lojaID" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "sku" TEXT,
    "source" TEXT NOT NULL,
    "previousStock" INTEGER NOT NULL,
    "newStock" INTEGER NOT NULL,
    "nuvemshopEventId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Brand" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "logoUrl" TEXT,
    "description" TEXT,
    "websiteUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lojaID" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CategoryTag" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "group" TEXT NOT NULL DEFAULT 'GERAL',
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "lojaID" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProductCategoryTag" (
    "productID" TEXT NOT NULL,
    "categoryTagID" TEXT NOT NULL,

    CONSTRAINT "ProductCategoryTag_pkey" PRIMARY KEY ("productID","categoryTagID")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "JtExpressGeocom" (
    "id" TEXT NOT NULL,
    "state" VARCHAR(2) NOT NULL,
    "cityPattern" TEXT,
    "cepStart" VARCHAR(8) NOT NULL,
    "cepEnd" VARCHAR(8) NOT NULL,
    "geocomCode" TEXT NOT NULL,
    "deliveryDays" INTEGER NOT NULL DEFAULT 3,
    "isRiskZone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JtExpressGeocom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "JtExpressRate" (
    "id" TEXT NOT NULL,
    "geocom" TEXT NOT NULL,
    "macroRegion" TEXT NOT NULL,
    "weightMin" DECIMAL(8,3) NOT NULL,
    "weightMax" DECIMAL(8,3) NOT NULL,
    "basePrice" DECIMAL(10,2) NOT NULL,
    "additionalKgPrice" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JtExpressRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StockSyncLog_lojaID_idx" ON "StockSyncLog"("lojaID");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StockSyncLog_sku_idx" ON "StockSyncLog"("sku");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StockSyncLog_createdAt_idx" ON "StockSyncLog"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Brand_lojaID_idx" ON "Brand"("lojaID");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Brand_lojaID_isActive_idx" ON "Brand"("lojaID", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Brand_lojaID_slug_key" ON "Brand"("lojaID", "slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CategoryTag_lojaID_idx" ON "CategoryTag"("lojaID");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CategoryTag_lojaID_order_idx" ON "CategoryTag"("lojaID", "order");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CategoryTag_lojaID_slug_key" ON "CategoryTag"("lojaID", "slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProductCategoryTag_categoryTagID_idx" ON "ProductCategoryTag"("categoryTagID");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProductCategoryTag_productID_idx" ON "ProductCategoryTag"("productID");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "JtExpressGeocom_cepStart_cepEnd_idx" ON "JtExpressGeocom"("cepStart", "cepEnd");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "JtExpressGeocom_geocomCode_idx" ON "JtExpressGeocom"("geocomCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "JtExpressGeocom_state_idx" ON "JtExpressGeocom"("state");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "JtExpressRate_geocom_idx" ON "JtExpressRate"("geocom");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "JtExpressRate_geocom_weightMin_weightMax_idx" ON "JtExpressRate"("geocom", "weightMin", "weightMax");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "JtExpressRate_geocom_weightMin_weightMax_key" ON "JtExpressRate"("geocom", "weightMin", "weightMax");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_syncStatus_idx" ON "Order"("syncStatus");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_nuvemshopOrderId_idx" ON "Order"("nuvemshopOrderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_lojaID_idx" ON "Order"("lojaID");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_lojaID_status_createdAt_idx" ON "Order"("lojaID", "status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrderItem_productVariantsId_idx" ON "OrderItem"("productVariantsId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_lojaID_idx" ON "Product"("lojaID");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_lojaID_sku_idx" ON "Product"("lojaID", "sku");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_lojaID_brandID_idx" ON "Product"("lojaID", "brandID");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_nuvemshopProductId_idx" ON "Product"("nuvemshopProductId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_createdAt_idx" ON "Product"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProductVariants_ProductID_idx" ON "ProductVariants"("ProductID");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProductVariants_sku_idx" ON "ProductVariants"("sku");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProductVariants_nuvemshopVariantId_idx" ON "ProductVariants"("nuvemshopVariantId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_lojaID_key" ON "User"("email", "lojaID");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_brandID_fkey' AND conrelid = '"Product"'::regclass) THEN
    ALTER TABLE "Product" ADD CONSTRAINT "Product_brandID_fkey" FOREIGN KEY ("brandID") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Order_addressID_fkey' AND conrelid = '"Order"'::regclass) THEN
    ALTER TABLE "Order" ADD CONSTRAINT "Order_addressID_fkey" FOREIGN KEY ("addressID") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrderItem_productId_fkey' AND conrelid = '"OrderItem"'::regclass) THEN
    ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Brand_lojaID_fkey' AND conrelid = '"Brand"'::regclass) THEN
    ALTER TABLE "Brand" ADD CONSTRAINT "Brand_lojaID_fkey" FOREIGN KEY ("lojaID") REFERENCES "Loja"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CategoryTag_lojaID_fkey' AND conrelid = '"CategoryTag"'::regclass) THEN
    ALTER TABLE "CategoryTag" ADD CONSTRAINT "CategoryTag_lojaID_fkey" FOREIGN KEY ("lojaID") REFERENCES "Loja"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductCategoryTag_productID_fkey' AND conrelid = '"ProductCategoryTag"'::regclass) THEN
    ALTER TABLE "ProductCategoryTag" ADD CONSTRAINT "ProductCategoryTag_productID_fkey" FOREIGN KEY ("productID") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductCategoryTag_categoryTagID_fkey' AND conrelid = '"ProductCategoryTag"'::regclass) THEN
    ALTER TABLE "ProductCategoryTag" ADD CONSTRAINT "ProductCategoryTag_categoryTagID_fkey" FOREIGN KEY ("categoryTagID") REFERENCES "CategoryTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
-- The restored database has the completed historical migrations but is missing
-- these historical indexes. Recreate them without editing that history.
CREATE INDEX IF NOT EXISTS "Address_userID_createdAt_idx" ON "Address"("userID", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "Cart_userID_status_idx" ON "Cart"("userID", "status");
CREATE INDEX IF NOT EXISTS "Order_lojaID_createdAt_idx" ON "Order"("lojaID", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_lojaID_status_idx" ON "Order"("lojaID", "status");
CREATE INDEX IF NOT EXISTS "Order_lojaID_userID_idx" ON "Order"("lojaID", "userID");
CREATE INDEX IF NOT EXISTS "Product_lojaID_createdAt_idx" ON "Product"("lojaID", "createdAt");
CREATE INDEX IF NOT EXISTS "Product_lojaID_stock_idx" ON "Product"("lojaID", "stock");
CREATE INDEX IF NOT EXISTS "User_lojaID_status_idx" ON "User"("lojaID", "status");
CREATE INDEX IF NOT EXISTS "User_lojaID_role_idx" ON "User"("lojaID", "role");
COMMIT;
