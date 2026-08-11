-- DropIndex
DROP INDEX "Order_addressID_idx";

-- DropIndex
DROP INDEX "Order_status_idx";

-- DropIndex
DROP INDEX "Order_userID_idx";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "pixKeyUsed" TEXT;
