BEGIN;
SET LOCAL lock_timeout = '10s';
LOCK TABLE "Cart" IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "Cart" WHERE status = 'ACTIVE' GROUP BY "lojaID", "userID" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Active cart duplicates: audit owner/items and reconcile with backup before applying this migration';
  END IF;
END $$;
CREATE UNIQUE INDEX "Cart_active_owner_key" ON "Cart" ("lojaID", "userID") WHERE status = 'ACTIVE';
COMMIT;
