CREATE TABLE "AnalyticsMonitorState" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "lastSuccessfulRunAt" TIMESTAMP(3),
  "notifiedSignature" TEXT,
  "notificationKey" TEXT,
  "notificationPayload" JSONB,
  "notificationSignature" TEXT,
  "notificationLease" TIMESTAMP(3),
  "nextNotificationAt" TIMESTAMP(3),
  "lastCoverageAuditAt" TIMESTAMP(3),
  "coverageAudit" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
ALTER TABLE "AnalyticsMonitorState" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "AnalyticsMonitorState" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON TABLE "AnalyticsMonitorState" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON TABLE "AnalyticsMonitorState" FROM authenticated; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN REVOKE ALL ON TABLE "AnalyticsMonitorState" FROM service_role; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='flownana_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "AnalyticsMonitorState" TO flownana_app;
    CREATE POLICY flownana_server_all ON "AnalyticsMonitorState" FOR ALL TO flownana_app USING (true) WITH CHECK (true);
  END IF;
END $$;
