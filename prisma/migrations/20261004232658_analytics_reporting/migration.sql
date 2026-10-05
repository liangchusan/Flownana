-- CreateTable
CREATE TABLE "AnalyticsContext" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountCreatedAt" TIMESTAMP(3) NOT NULL,
    "environment" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "context" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseUntil" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transmittedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsContext_userId_environment_idx" ON "AnalyticsContext"("userId", "environment");

-- CreateIndex
CREATE INDEX "AnalyticsReport_environment_status_nextAttemptAt_idx" ON "AnalyticsReport"("environment", "status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "AnalyticsReport_userId_name_occurredAt_idx" ON "AnalyticsReport"("userId", "name", "occurredAt");

-- AddForeignKey
ALTER TABLE "AnalyticsContext" ADD CONSTRAINT "AnalyticsContext_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsReport" ADD CONSTRAINT "AnalyticsReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Server Prisma role only. No anonymous or authenticated Data API policies.
ALTER TABLE "AnalyticsContext" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnalyticsReport" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "AnalyticsContext", "AnalyticsReport" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON TABLE "AnalyticsContext", "AnalyticsReport" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON TABLE "AnalyticsContext", "AnalyticsReport" FROM authenticated; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN REVOKE ALL ON TABLE "AnalyticsContext", "AnalyticsReport" FROM service_role; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'flownana_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "AnalyticsContext", "AnalyticsReport" TO flownana_app;
    CREATE POLICY flownana_server_all ON "AnalyticsContext" FOR ALL TO flownana_app USING (true) WITH CHECK (true);
    CREATE POLICY flownana_server_all ON "AnalyticsReport" FOR ALL TO flownana_app USING (true) WITH CHECK (true);
  END IF;
END $$;
