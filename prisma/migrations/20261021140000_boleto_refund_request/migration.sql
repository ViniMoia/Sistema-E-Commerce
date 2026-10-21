-- Preserve existing commands. Older workers claim READY only and must not
-- dispatch the new boleto operation through their generic refund endpoint.
BEGIN;
ALTER TABLE "PaymentOperation" ADD COLUMN "refundRequestUrl" TEXT;
ALTER TABLE "PaymentOperation" DROP CONSTRAINT "PaymentOperation_status_check";
ALTER TABLE "PaymentOperation" ADD CONSTRAINT "PaymentOperation_status_check"
  CHECK (status IN ('READY','BOLETO_READY','SUBMITTING','UNKNOWN','PENDING','COMPLETED'));
CREATE FUNCTION boleto_refund_operation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'BOLETO_READY' THEN
    IF NEW.kind <> 'REFUND' OR NEW."submittedAt" IS NOT NULL OR NOT EXISTS (
      SELECT 1 FROM "PaymentAttempt" a WHERE a.id=NEW."attemptId" AND a.method='BOLETO' AND a.provider='ASAAS' AND a.installments=1
    ) THEN RAISE EXCEPTION 'PAYMENT_BOLETO_OPERATION_INVALID'; END IF;
    IF TG_OP='UPDATE' AND OLD.status <> 'BOLETO_READY' THEN
      RAISE EXCEPTION 'PAYMENT_OPERATION_RESUBMISSION_FORBIDDEN';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "PaymentOperation_boleto_guard" BEFORE INSERT OR UPDATE ON "PaymentOperation"
  FOR EACH ROW EXECUTE FUNCTION boleto_refund_operation_guard();
COMMIT;
