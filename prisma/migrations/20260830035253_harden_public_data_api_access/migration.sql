-- Keep the browser-facing Supabase Data API outside Flownana's business-data
-- boundary. Next.js Server and Prisma remain the only application data path.

CREATE TABLE public."MediaUploadGrant" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "maxBytes" INTEGER NOT NULL,
  "blobUrl" TEXT,
  "actualBytes" INTEGER,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "MediaUploadGrant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MediaUploadGrant_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES public."User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MediaUploadGrant_blobUrl_key" ON public."MediaUploadGrant"("blobUrl");
CREATE INDEX "MediaUploadGrant_userId_createdAt_idx" ON public."MediaUploadGrant"("userId", "createdAt");
CREATE INDEX "MediaUploadGrant_userId_completedAt_idx" ON public."MediaUploadGrant"("userId", "completedAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'flownana_app') THEN
    CREATE ROLE flownana_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$$;

-- Supabase's managed postgres role may create a least-privilege role but may
-- not ALTER SUPERUSER/BYPASSRLS attributes afterwards. Those attributes are
-- fixed at creation; the release process enables LOGIN and sets the password.

-- Apply the intended RLS state to every current business and infrastructure
-- table. Repeating ENABLE is safe and makes a fresh migration replay match
-- production, where Generation was enabled outside the checked-in history.
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CreditBatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Generation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MediaAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."GenerationMedia" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ProcessedStripeEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MediaUploadGrant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_prisma_migrations" ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies are created. Removing object privileges as
-- well as relying on RLS default-deny provides two independent controls.
REVOKE ALL PRIVILEGES ON TABLE
  public."User",
  public."Subscription",
  public."CreditBatch",
  public."Generation",
  public."MediaAsset",
  public."GenerationMedia",
  public."ProcessedStripeEvent",
  public."MediaUploadGrant",
  public."_prisma_migrations"
FROM PUBLIC, anon, authenticated, service_role;

DO $$
DECLARE
  owned_function regprocedure;
BEGIN
  FOR owned_function IN
    SELECT p.oid::regprocedure
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proowner = (current_user::regrole)::oid
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role',
      owned_function
    );
  END LOOP;
END
$$;

GRANT USAGE ON SCHEMA public TO flownana_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public."User",
  public."Subscription",
  public."CreditBatch",
  public."Generation",
  public."MediaAsset",
  public."GenerationMedia",
  public."ProcessedStripeEvent",
  public."MediaUploadGrant"
TO flownana_app;

CREATE POLICY flownana_server_all ON public."User"
  FOR ALL TO flownana_app USING (true) WITH CHECK (true);
CREATE POLICY flownana_server_all ON public."Subscription"
  FOR ALL TO flownana_app USING (true) WITH CHECK (true);
CREATE POLICY flownana_server_all ON public."CreditBatch"
  FOR ALL TO flownana_app USING (true) WITH CHECK (true);
CREATE POLICY flownana_server_all ON public."Generation"
  FOR ALL TO flownana_app USING (true) WITH CHECK (true);
CREATE POLICY flownana_server_all ON public."MediaAsset"
  FOR ALL TO flownana_app USING (true) WITH CHECK (true);
CREATE POLICY flownana_server_all ON public."GenerationMedia"
  FOR ALL TO flownana_app USING (true) WITH CHECK (true);
CREATE POLICY flownana_server_all ON public."ProcessedStripeEvent"
  FOR ALL TO flownana_app USING (true) WITH CHECK (true);
CREATE POLICY flownana_server_all ON public."MediaUploadGrant"
  FOR ALL TO flownana_app USING (true) WITH CHECK (true);

-- Prevent future objects created by the Prisma/migration owner from silently
-- becoming reachable by any Data API role. The runtime role is granted only
-- explicit application-table privileges above.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;
