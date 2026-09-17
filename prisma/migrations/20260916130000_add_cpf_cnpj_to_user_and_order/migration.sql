-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customerCpfCnpj" VARCHAR(20);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cpfCnpj" VARCHAR(20);

-- CreateIndex
CREATE INDEX "Order_customerCpfCnpj_idx" ON "Order"("customerCpfCnpj");

-- CreateIndex
CREATE INDEX "User_cpfCnpj_idx" ON "User"("cpfCnpj");

-- CreateIndex
CREATE INDEX "User_cpfCnpj_lojaID_idx" ON "User"("cpfCnpj", "lojaID");
