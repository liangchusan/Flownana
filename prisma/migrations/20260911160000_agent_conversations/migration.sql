-- CreateTable
CREATE TABLE "AgentConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "templateId" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "cleanupUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentTurn" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "sourceContext" TEXT NOT NULL DEFAULT '',
    "responseKind" TEXT,
    "providerUsage" JSONB,
    "response" TEXT NOT NULL DEFAULT '',
    "suggestions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "quote" JSONB,
    "quoteExpiresAt" TIMESTAMP(3),
    "generationIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'running',
    "error" TEXT,
    "day" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "leaseUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentTurn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentUsage" (
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "attempts" TIMESTAMP(3)[] DEFAULT ARRAY[]::TIMESTAMP(3)[],

    CONSTRAINT "AgentUsage_pkey" PRIMARY KEY ("userId","day")
);

-- CreateTable
CREATE TABLE "AgentAttachment" (
    "conversationId" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,

    CONSTRAINT "AgentAttachment_pkey" PRIMARY KEY ("conversationId","mediaAssetId")
);

-- CreateIndex
CREATE INDEX "AgentConversation_userId_updatedAt_idx" ON "AgentConversation"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "AgentTurn_conversationId_createdAt_idx" ON "AgentTurn"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentTurn_status_leaseUntil_idx" ON "AgentTurn"("status", "leaseUntil");

-- CreateIndex
CREATE INDEX "AgentAttachment_mediaAssetId_idx" ON "AgentAttachment"("mediaAssetId");

-- AddForeignKey
ALTER TABLE "AgentConversation" ADD CONSTRAINT "AgentConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTurn" ADD CONSTRAINT "AgentTurn_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AgentConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentUsage" ADD CONSTRAINT "AgentUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAttachment" ADD CONSTRAINT "AgentAttachment_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AgentConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAttachment" ADD CONSTRAINT "AgentAttachment_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "AgentConversation" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "AgentConversation" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON TABLE "AgentConversation" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON TABLE "AgentConversation" FROM authenticated; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN REVOKE ALL ON TABLE "AgentConversation" FROM service_role; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'flownana_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "AgentConversation" TO flownana_app;
    CREATE POLICY flownana_server_all ON "AgentConversation" FOR ALL TO flownana_app USING (true) WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE "AgentTurn" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "AgentTurn" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON TABLE "AgentTurn" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON TABLE "AgentTurn" FROM authenticated; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN REVOKE ALL ON TABLE "AgentTurn" FROM service_role; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'flownana_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "AgentTurn" TO flownana_app;
    CREATE POLICY flownana_server_all ON "AgentTurn" FOR ALL TO flownana_app USING (true) WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE "AgentUsage" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "AgentUsage" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON TABLE "AgentUsage" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON TABLE "AgentUsage" FROM authenticated; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN REVOKE ALL ON TABLE "AgentUsage" FROM service_role; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'flownana_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "AgentUsage" TO flownana_app;
    CREATE POLICY flownana_server_all ON "AgentUsage" FOR ALL TO flownana_app USING (true) WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE "AgentAttachment" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "AgentAttachment" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON TABLE "AgentAttachment" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON TABLE "AgentAttachment" FROM authenticated; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN REVOKE ALL ON TABLE "AgentAttachment" FROM service_role; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'flownana_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "AgentAttachment" TO flownana_app;
    CREATE POLICY flownana_server_all ON "AgentAttachment" FOR ALL TO flownana_app USING (true) WITH CHECK (true);
  END IF;
END $$;
