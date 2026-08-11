/*
  Warnings:

  - A unique constraint covering the columns `[cartID,variantID]` on the table `CartItem` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `color` to the `CartItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `imageUrl` to the `CartItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `size` to the `CartItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "shippingCost" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "color" TEXT NOT NULL,
ADD COLUMN     "imageUrl" TEXT NOT NULL,
ADD COLUMN     "size" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Cart_userID_idx" ON "Cart"("userID");

-- CreateIndex
CREATE INDEX "Cart_status_idx" ON "Cart"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartID_variantID_key" ON "CartItem"("cartID", "variantID");
