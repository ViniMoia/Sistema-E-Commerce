/*
  Warnings:

  - Added the required column `lojaID` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "lojaID" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_lojaID_fkey" FOREIGN KEY ("lojaID") REFERENCES "Loja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
