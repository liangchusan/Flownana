CREATE TABLE "SignupIpWindow" (
  "ipHash" TEXT PRIMARY KEY CHECK ("ipHash" ~ '^[a-f0-9]{64}$'),
  "startedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CHECK ("expiresAt" = "startedAt" + INTERVAL '72 hours')
);
CREATE INDEX "SignupIpWindow_expiresAt_idx" ON "SignupIpWindow"("expiresAt");

CREATE TABLE "SignupBonusDecision" (
  "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "reason" TEXT NOT NULL CHECK ("reason" IN ('granted', 'ip_limit', 'country_ineligible', 'source_unavailable')),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Prisma cannot represent this partial index; it guards one gift per account.
CREATE UNIQUE INDEX "CreditBatch_signup_bonus_userId_key"
  ON "CreditBatch"("userId") WHERE "source" = 'signup-bonus';

ALTER TABLE "SignupIpWindow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SignupBonusDecision" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "SignupIpWindow", "SignupBonusDecision" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON TABLE "SignupIpWindow", "SignupBonusDecision" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON TABLE "SignupIpWindow", "SignupBonusDecision" FROM authenticated; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN REVOKE ALL ON TABLE "SignupIpWindow", "SignupBonusDecision" FROM service_role; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='flownana_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "SignupIpWindow", "SignupBonusDecision" TO flownana_app;
    CREATE POLICY flownana_server_all ON "SignupIpWindow" FOR ALL TO flownana_app USING (true) WITH CHECK (true);
    CREATE POLICY flownana_server_all ON "SignupBonusDecision" FOR ALL TO flownana_app USING (true) WITH CHECK (true);
  END IF;
END $$;
