BEGIN;
SET LOCAL lock_timeout = '10s';
ALTER TABLE "Product" ADD COLUMN "catalogVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD CONSTRAINT "Product_catalog_version_check" CHECK ("catalogVersion" >= 0);
COMMIT;
