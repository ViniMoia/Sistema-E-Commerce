CREATE UNIQUE INDEX "Order_id_lojaID_key" ON "Order"("id", "lojaID");

ALTER TABLE "RefundIntent"
  DROP CONSTRAINT "RefundIntent_orderID_fkey";

ALTER TABLE "RefundIntent"
  ADD CONSTRAINT "RefundIntent_orderID_lojaID_fkey"
  FOREIGN KEY ("orderID", "lojaID")
  REFERENCES "Order"("id", "lojaID")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
