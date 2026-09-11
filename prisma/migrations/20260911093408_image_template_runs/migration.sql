-- CreateTable
CREATE TABLE "ImageTemplateRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountCreatedAt" TIMESTAMP(3) NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "parseRetries" INTEGER NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "input" JSONB NOT NULL,
    "analysis" JSONB,
    "generationIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "error" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageTemplateRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImageTemplateRun_userId_templateId_createdAt_idx" ON "ImageTemplateRun"("userId", "templateId", "createdAt");

-- AddForeignKey
ALTER TABLE "ImageTemplateRun" ADD CONSTRAINT "ImageTemplateRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "ImageTemplateRun" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "ImageTemplateRun" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON TABLE "ImageTemplateRun" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON TABLE "ImageTemplateRun" FROM authenticated; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN REVOKE ALL ON TABLE "ImageTemplateRun" FROM service_role; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'flownana_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "ImageTemplateRun" TO flownana_app;
    CREATE POLICY flownana_server_all ON "ImageTemplateRun" FOR ALL TO flownana_app USING (true) WITH CHECK (true);
  END IF;
END $$;
