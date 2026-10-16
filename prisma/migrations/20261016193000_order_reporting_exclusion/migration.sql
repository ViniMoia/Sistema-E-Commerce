-- Schema only: no existing order is classified or changed by this migration.
CREATE TABLE "OrderReportingExclusion" (
  "orderId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "classificationBatch" TEXT NOT NULL,
  "classifiedBy" TEXT NOT NULL,
  "classifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderReportingExclusion_pkey" PRIMARY KEY ("orderId"),
  CONSTRAINT "OrderReportingExclusion_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "order_reporting_exclusion_reason" CHECK ("reason" = 'USER_CLASSIFIED_TEST_DATA'),
  CONSTRAINT "order_reporting_exclusion_provenance" CHECK (length(trim("classificationBatch")) > 0 AND length(trim("classifiedBy")) > 0)
);
CREATE INDEX "OrderReportingExclusion_classificationBatch_idx" ON "OrderReportingExclusion"("classificationBatch");
