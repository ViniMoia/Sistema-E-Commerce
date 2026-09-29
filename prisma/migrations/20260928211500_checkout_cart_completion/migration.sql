ALTER TABLE "Order"
  ADD COLUMN "sourceCartID" TEXT;

CREATE UNIQUE INDEX "Order_sourceCartID_key"
  ON "Order"("sourceCartID");

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_sourceCartID_fkey"
  FOREIGN KEY ("sourceCartID") REFERENCES "Cart"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
