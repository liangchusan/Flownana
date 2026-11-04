CREATE TABLE "CheckoutHistoryMigration" (
  "id" TEXT PRIMARY KEY,
  "cutoffAt" TIMESTAMP(3),
  "cursor" TEXT,
  "completedAt" TIMESTAMP(3)
);
CREATE TABLE "LegacyCheckout" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "accountCreatedAt" TIMESTAMP(3),
  "reservationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "LegacyCheckout_userId_createdAt_idx" ON "LegacyCheckout"("userId", "createdAt");
CREATE INDEX "LegacyCheckout_reservationId_idx" ON "LegacyCheckout"("reservationId");
INSERT INTO "CheckoutHistoryMigration" ("id") VALUES ('legacy-checkouts-v1');
ALTER TABLE "CheckoutHistoryMigration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LegacyCheckout" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "CheckoutHistoryMigration", "LegacyCheckout" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON TABLE "CheckoutHistoryMigration", "LegacyCheckout" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON TABLE "CheckoutHistoryMigration", "LegacyCheckout" FROM authenticated; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN REVOKE ALL ON TABLE "CheckoutHistoryMigration", "LegacyCheckout" FROM service_role; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='flownana_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "CheckoutHistoryMigration", "LegacyCheckout" TO flownana_app;
    CREATE POLICY flownana_server_all ON "CheckoutHistoryMigration" FOR ALL TO flownana_app USING (true) WITH CHECK (true);
    CREATE POLICY flownana_server_all ON "LegacyCheckout" FOR ALL TO flownana_app USING (true) WITH CHECK (true);
  END IF;
END $$;
