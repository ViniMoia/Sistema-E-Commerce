BEGIN;

-- Reconciles the versioned migration history with schema.prisma without
-- removing the performance indexes already present in deployed databases.
-- This migration is intentionally additive/corrective and must be rehearsed
-- against each environment before `prisma migrate deploy`.

-- Enum used by Order synchronization.
DO $$
BEGIN
  CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'PROCESSING', 'SYNCED', 'FAILED', 'DEAD_LETTER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "DeliveryType" ADD VALUE IF NOT EXISTS 'NONE';

-- Store/integration fields. Nullable fields need no destructive backfill;
-- booleans/integers receive the same defaults declared by Prisma.
ALTER TABLE "Loja"
  ADD COLUMN IF NOT EXISTS "additionalDays" INTEGER NOT NULL DEFAULT 0,
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

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "brandID" TEXT,
  ADD COLUMN IF NOT EXISTS "freeShipping" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "heightCm" INTEGER DEFAULT 4,
  ADD COLUMN IF NOT EXISTS "lengthCm" INTEGER DEFAULT 16,
  ADD COLUMN IF NOT EXISTS "nuvemshopProductId" TEXT,
  ADD COLUMN IF NOT EXISTS "sku" TEXT,
  ADD COLUMN IF NOT EXISTS "stockBuffer" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "tagsSearchCache" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "weightInGrams" INTEGER DEFAULT 300,
  ADD COLUMN IF NOT EXISTS "widthCm" INTEGER DEFAULT 11;

ALTER TABLE "ProductVariants"
  ADD COLUMN IF NOT EXISTS "nuvemshopVariantId" TEXT,
  ADD COLUMN IF NOT EXISTS "sku" TEXT;

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "asaasBankSlipUrl" TEXT,
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
  ADD COLUMN IF NOT EXISTS "syncStatus" "SyncStatus" NOT NULL DEFAULT 'PENDING';

-- The canonical model intentionally preserves order history after address or
-- product removal. Existing foreign keys already prove current references.
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_addressID_fkey";
ALTER TABLE "Order" ALTER COLUMN "addressID" DROP NOT NULL;
ALTER TABLE "Order" ADD CONSTRAINT "Order_addressID_fkey"
  FOREIGN KEY ("addressID") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_productId_fkey";
ALTER TABLE "OrderItem" ALTER COLUMN "productId" DROP NOT NULL;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LoyaltyWallet" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- DB-002: different variants of the same product are distinct order lines.
DROP INDEX IF EXISTS "OrderItem_orderId_productId_key";

-- DB-011: create the less restrictive tenant-aware key before dropping the
-- global key. A globally unique dataset is necessarily valid for this index.
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_lojaID_key" ON "User"("email", "lojaID");
DROP INDEX IF EXISTS "User_email_key";

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
  CONSTRAINT "Brand_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Brand_lojaID_fkey" FOREIGN KEY ("lojaID") REFERENCES "Loja"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
  CONSTRAINT "CategoryTag_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CategoryTag_lojaID_fkey" FOREIGN KEY ("lojaID") REFERENCES "Loja"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ProductCategoryTag" (
  "productID" TEXT NOT NULL,
  "categoryTagID" TEXT NOT NULL,
  CONSTRAINT "ProductCategoryTag_pkey" PRIMARY KEY ("productID", "categoryTagID"),
  CONSTRAINT "ProductCategoryTag_productID_fkey" FOREIGN KEY ("productID") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCategoryTag_categoryTagID_fkey" FOREIGN KEY ("categoryTagID") REFERENCES "CategoryTag"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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

-- Indexes below correspond to declared relations and observed lookup/order
-- predicates. Existing performance indexes are preserved, not recreated.
CREATE INDEX IF NOT EXISTS "StockSyncLog_lojaID_idx" ON "StockSyncLog"("lojaID");
CREATE INDEX IF NOT EXISTS "StockSyncLog_sku_idx" ON "StockSyncLog"("sku");
CREATE INDEX IF NOT EXISTS "StockSyncLog_createdAt_idx" ON "StockSyncLog"("createdAt");
CREATE INDEX IF NOT EXISTS "Brand_lojaID_idx" ON "Brand"("lojaID");
CREATE INDEX IF NOT EXISTS "Brand_lojaID_isActive_idx" ON "Brand"("lojaID", "isActive");
CREATE UNIQUE INDEX IF NOT EXISTS "Brand_lojaID_slug_key" ON "Brand"("lojaID", "slug");
CREATE INDEX IF NOT EXISTS "CategoryTag_lojaID_idx" ON "CategoryTag"("lojaID");
CREATE INDEX IF NOT EXISTS "CategoryTag_lojaID_order_idx" ON "CategoryTag"("lojaID", "order");
CREATE UNIQUE INDEX IF NOT EXISTS "CategoryTag_lojaID_slug_key" ON "CategoryTag"("lojaID", "slug");
CREATE INDEX IF NOT EXISTS "ProductCategoryTag_categoryTagID_idx" ON "ProductCategoryTag"("categoryTagID");
CREATE INDEX IF NOT EXISTS "ProductCategoryTag_productID_idx" ON "ProductCategoryTag"("productID");
CREATE INDEX IF NOT EXISTS "JtExpressGeocom_cepStart_cepEnd_idx" ON "JtExpressGeocom"("cepStart", "cepEnd");
CREATE INDEX IF NOT EXISTS "JtExpressGeocom_geocomCode_idx" ON "JtExpressGeocom"("geocomCode");
CREATE INDEX IF NOT EXISTS "JtExpressGeocom_state_idx" ON "JtExpressGeocom"("state");
CREATE INDEX IF NOT EXISTS "JtExpressRate_geocom_idx" ON "JtExpressRate"("geocom");
CREATE INDEX IF NOT EXISTS "JtExpressRate_geocom_weightMin_weightMax_idx" ON "JtExpressRate"("geocom", "weightMin", "weightMax");
CREATE UNIQUE INDEX IF NOT EXISTS "JtExpressRate_geocom_weightMin_weightMax_key" ON "JtExpressRate"("geocom", "weightMin", "weightMax");
CREATE INDEX IF NOT EXISTS "Order_syncStatus_idx" ON "Order"("syncStatus");
CREATE INDEX IF NOT EXISTS "Order_nuvemshopOrderId_idx" ON "Order"("nuvemshopOrderId");
CREATE INDEX IF NOT EXISTS "Order_lojaID_idx" ON "Order"("lojaID");
CREATE INDEX IF NOT EXISTS "Order_lojaID_status_createdAt_idx" ON "Order"("lojaID", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX IF NOT EXISTS "OrderItem_productVariantsId_idx" ON "OrderItem"("productVariantsId");
CREATE INDEX IF NOT EXISTS "Product_lojaID_idx" ON "Product"("lojaID");
CREATE INDEX IF NOT EXISTS "Product_lojaID_sku_idx" ON "Product"("lojaID", "sku");
CREATE INDEX IF NOT EXISTS "Product_lojaID_brandID_idx" ON "Product"("lojaID", "brandID");
CREATE INDEX IF NOT EXISTS "Product_nuvemshopProductId_idx" ON "Product"("nuvemshopProductId");
CREATE INDEX IF NOT EXISTS "Product_createdAt_idx" ON "Product"("createdAt");
CREATE INDEX IF NOT EXISTS "ProductVariants_ProductID_idx" ON "ProductVariants"("ProductID");
CREATE INDEX IF NOT EXISTS "ProductVariants_sku_idx" ON "ProductVariants"("sku");
CREATE INDEX IF NOT EXISTS "ProductVariants_nuvemshopVariantId_idx" ON "ProductVariants"("nuvemshopVariantId");

ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_brandID_fkey";
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandID_fkey"
  FOREIGN KEY ("brandID") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
