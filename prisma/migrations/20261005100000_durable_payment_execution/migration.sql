BEGIN;
ALTER TABLE "PaymentAttempt" ADD COLUMN "leaseOwner" TEXT,
  ADD COLUMN "leaseExpiresAt" TIMESTAMP(3), ADD COLUMN "reconcileAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "reservationExpiresAt" TIMESTAMP(3), ADD COLUMN "reviewAfter" TIMESTAMP(3);
ALTER TABLE "PaymentAttempt" ADD COLUMN "providerAccount" VARCHAR(24);
ALTER TABLE "PaymentCharge" ADD COLUMN "providerAccount" VARCHAR(24);
ALTER TABLE "FinancialFact" ADD COLUMN "providerAccount" VARCHAR(24);
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_lease_pair" CHECK (("leaseOwner" IS NULL) = ("leaseExpiresAt" IS NULL)),
  ADD CONSTRAINT "PaymentAttempt_reconcile_nonnegative" CHECK ("reconcileAttempts" >= 0);
CREATE TABLE "PaymentOperation" (
  "id" TEXT NOT NULL, "attemptId" TEXT NOT NULL, "chargeId" TEXT NOT NULL,
  "kind" VARCHAR(16) NOT NULL, "commandKey" VARCHAR(64) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'READY', "requestedById" VARCHAR(128),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submittedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3), "lastErrorCode" VARCHAR(96),
  CONSTRAINT "PaymentOperation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentOperation_kind_check" CHECK ("kind" IN ('CANCEL','REFUND')),
  CONSTRAINT "PaymentOperation_status_check" CHECK ("status" IN ('READY','SUBMITTING','UNKNOWN','PENDING','COMPLETED')),
  CONSTRAINT "PaymentOperation_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "PaymentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PaymentOperation_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "PaymentCharge"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PaymentOperation_chargeId_kind_key" ON "PaymentOperation"("chargeId", "kind");
CREATE INDEX "PaymentOperation_attemptId_status_idx" ON "PaymentOperation"("attemptId", "status");
CREATE FUNCTION payment_operation_provenance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "PaymentCharge" c WHERE c.id=NEW."chargeId" AND c."attemptId"=NEW."attemptId") THEN
    RAISE EXCEPTION 'PAYMENT_OPERATION_PROVENANCE_INVALID';
  END IF;
  IF TG_OP='UPDATE' AND (NEW."attemptId",NEW."chargeId",NEW.kind,NEW."commandKey") IS DISTINCT FROM
    (OLD."attemptId",OLD."chargeId",OLD.kind,OLD."commandKey") THEN RAISE EXCEPTION 'PAYMENT_OPERATION_IDENTITY_IMMUTABLE'; END IF;
  IF TG_OP='UPDATE' AND OLD.status<>'READY' AND NEW.status='READY' THEN RAISE EXCEPTION 'PAYMENT_OPERATION_RESUBMISSION_FORBIDDEN'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "PaymentOperation_provenance" BEFORE INSERT OR UPDATE ON "PaymentOperation" FOR EACH ROW EXECUTE FUNCTION payment_operation_provenance();
CREATE FUNCTION financial_fact_provenance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' AND ROW(NEW.*) IS DISTINCT FROM ROW(OLD.*) THEN RAISE EXCEPTION 'FINANCIAL_FACT_IMMUTABLE'; END IF;
  IF NEW."attemptId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "PaymentAttempt" a WHERE a.id=NEW."attemptId" AND a."orderId"=NEW."orderId" AND a.provider=NEW.provider
      AND a."providerAccount" IS NOT DISTINCT FROM NEW."providerAccount" AND a."financialTotal">=NEW.amount
  ) THEN RAISE EXCEPTION 'FINANCIAL_FACT_ATTEMPT_INVALID'; END IF;
  IF NEW."chargeId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "PaymentCharge" c JOIN "PaymentAttempt" a ON a.id=c."attemptId"
    WHERE c.id=NEW."chargeId" AND a.id=NEW."attemptId" AND a."orderId"=NEW."orderId"
    AND a.provider=NEW.provider AND c.provider=NEW.provider
    AND a."providerAccount" IS NOT DISTINCT FROM NEW."providerAccount"
    AND c."providerAccount" IS NOT DISTINCT FROM NEW."providerAccount" AND c.amount=NEW.amount
    AND ((NEW.type='AUTHORIZED' AND c."providerStatus" IN ('CONFIRMED','RECEIVED')) OR
      (NEW.type='SETTLED' AND c."providerStatus"='RECEIVED') OR (NEW.type='REFUNDED' AND c."providerStatus"='REFUNDED') OR
      (NEW.type='CANCELLED' AND c."providerStatus"='DELETED'))
  ) THEN RAISE EXCEPTION 'FINANCIAL_FACT_PROVENANCE_INVALID'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "FinancialFact_provenance" BEFORE INSERT OR UPDATE ON "FinancialFact" FOR EACH ROW EXECUTE FUNCTION financial_fact_provenance();
-- No inferred expiry, operations or financial facts for historical rows.
COMMIT;
