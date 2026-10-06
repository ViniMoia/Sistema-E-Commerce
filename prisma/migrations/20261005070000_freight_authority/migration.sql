BEGIN;
SET LOCAL lock_timeout = '10s';
ALTER TABLE "FreightRule" ADD COLUMN "state" VARCHAR(2), ADD COLUMN "municipalityCode" VARCHAR(7);
ALTER TABLE "FreightRule" ADD CONSTRAINT "chk_freight_rule_geography" CHECK (
  (state IS NULL AND "municipalityCode" IS NULL) OR
  (state IS NOT NULL AND state ~ '^[A-Z]{2}$' AND "municipalityCode" IS NOT NULL AND "municipalityCode" ~ '^[0-9]{7}$'));
ALTER TABLE "FreightQuote" ADD COLUMN fingerprint VARCHAR(64), ADD COLUMN "serviceCode" VARCHAR(120), ADD COLUMN snapshot JSONB;
ALTER TABLE "Order" ADD COLUMN "freightQuoteId" TEXT, ADD COLUMN "freightSnapshot" JSONB;
-- Legacy quotes/rules are preserved but have no authority under the new protocol.
CREATE TABLE "FreightTariffRevision" (id VARCHAR(32) PRIMARY KEY, version INTEGER NOT NULL DEFAULT 0);
INSERT INTO "FreightTariffRevision" (id) VALUES ('JT_EXPRESS');
CREATE FUNCTION bump_freight_settings_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(OLD."originCep",OLD."originState",OLD."originCity",OLD."originDistrict",OLD."originStreet",OLD."originNumber",OLD."originComplement",
    OLD."enableCorreios",OLD."correiosContractCode",OLD."correiosPassword",OLD."enablePickup",OLD."enableNoFreight",OLD."additionalDays")
    IS DISTINCT FROM ROW(NEW."originCep",NEW."originState",NEW."originCity",NEW."originDistrict",NEW."originStreet",NEW."originNumber",NEW."originComplement",
    NEW."enableCorreios",NEW."correiosContractCode",NEW."correiosPassword",NEW."enablePickup",NEW."enableNoFreight",NEW."additionalDays") THEN
    NEW."configurationVersion" := OLD."configurationVersion" + 1;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER freight_settings_revision BEFORE UPDATE ON "Loja" FOR EACH ROW EXECUTE FUNCTION bump_freight_settings_revision();
CREATE FUNCTION bump_freight_rule_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    UPDATE "Loja" SET "configurationVersion" = "configurationVersion" + 1 WHERE id = OLD."lojaID";
  END IF;
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW."lojaID" IS DISTINCT FROM OLD."lojaID") THEN
    UPDATE "Loja" SET "configurationVersion" = "configurationVersion" + 1 WHERE id = NEW."lojaID";
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER freight_rule_revision AFTER INSERT OR UPDATE OR DELETE ON "FreightRule" FOR EACH ROW EXECUTE FUNCTION bump_freight_rule_revision();
CREATE FUNCTION bump_freight_tariff_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "FreightTariffRevision" SET version = version + 1 WHERE id = 'JT_EXPRESS';
  IF NOT FOUND THEN RAISE EXCEPTION 'FREIGHT_REVISION_MISSING'; END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER freight_jt_rate_revision AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON "JtExpressRate" FOR EACH STATEMENT EXECUTE FUNCTION bump_freight_tariff_revision();
CREATE TRIGGER freight_jt_geography_revision AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON "JtExpressGeocom" FOR EACH STATEMENT EXECUTE FUNCTION bump_freight_tariff_revision();
COMMIT;
