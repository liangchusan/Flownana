# Production database security rollout

This runbook applies `20260830035253_harden_public_data_api_access` without
putting browser traffic or Prisma migrations on the same database role.

Never paste a database password into source control, migration SQL, tickets, or
command output. Generate the runtime password immediately before rollout and
store it only in the production secret manager.

## Preconditions

1. Confirm a current Supabase backup/PITR point exists.
2. Run `prisma migrate deploy` against a clean PostgreSQL 17 database and run
   the application test, lint, and build gates.
3. Keep production `DATABASE_URL` on the current owner connection while the
   migration runs. The owner bypasses non-forced RLS, so the migration does not
   interrupt the currently deployed server.
4. Prepare an owner/admin `DIRECT_URL` using a direct or session-pooler
   connection. Do not use the runtime role for migrations.

## Rollout

1. Apply the checked-in Prisma migration through the owner/admin connection.
2. Set a freshly generated password and enable login for the role created by
   the migration:

   ```sql
   ALTER ROLE flownana_app
     LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS
     PASSWORD '<fresh-secret-from-password-manager>';
   ```

3. Test the new role through the same Supabase transaction-pooler endpoint the
   Vercel application will use. Its pooler username is
   `flownana_app.<project-ref>`. Keep Prisma's transaction-pooler query options.
4. Replace only the Vercel Production `DATABASE_URL` with the new role URL and
   keep `DIRECT_URL` out of the application runtime unless a dedicated
   migration job requires it.
5. Deploy the application and run production smoke tests plus one authenticated
   read/write flow before removing the owner URL from the release operator's
   temporary environment.
6. Disable the Supabase Data API for the production project. Auth and Storage
   remain enabled; this setting removes REST/GraphQL access to business tables.

## SQL verification

Run as the migration owner. All nine rows must have `rls_enabled = true`; only
the eight application tables should report one `flownana_server_all` policy.

```sql
SELECT c.relname,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced,
       count(p.policyname) AS policy_count
FROM pg_class AS c
LEFT JOIN pg_policies AS p
  ON p.schemaname = 'public' AND p.tablename = c.relname
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relname IN (
    'User', 'Subscription', 'CreditBatch', 'Generation', 'MediaAsset',
    'GenerationMedia', 'ProcessedStripeEvent', 'MediaUploadGrant',
    '_prisma_migrations'
  )
GROUP BY c.relname, c.relrowsecurity, c.relforcerowsecurity
ORDER BY c.relname;
```

All privilege checks below must be false:

```sql
SELECT role_name, table_name,
       has_table_privilege(role_name, format('public.%I', table_name), 'SELECT') AS can_select,
       has_table_privilege(role_name, format('public.%I', table_name), 'INSERT') AS can_insert,
       has_table_privilege(role_name, format('public.%I', table_name), 'UPDATE') AS can_update,
       has_table_privilege(role_name, format('public.%I', table_name), 'DELETE') AS can_delete
FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) AS role_name
CROSS JOIN unnest(ARRAY[
  'User', 'Subscription', 'CreditBatch', 'Generation', 'MediaAsset',
  'GenerationMedia', 'ProcessedStripeEvent', 'MediaUploadGrant',
  '_prisma_migrations'
]) AS table_name
ORDER BY role_name, table_name;
```

The runtime role must have CRUD on the eight application tables and no access
to `_prisma_migrations`. Validate actual Prisma CRUD with the runtime connection,
not merely `SET ROLE` from an owner session.

## Emergency rollback

First restore the previous owner-backed Production `DATABASE_URL` and redeploy
the last known-good application. Only then run the following as the owner. This
deliberately restores the former Data API exposure and is an emergency
availability rollback, not a secure steady state.

```sql
DROP POLICY IF EXISTS flownana_server_all ON public."User";
DROP POLICY IF EXISTS flownana_server_all ON public."Subscription";
DROP POLICY IF EXISTS flownana_server_all ON public."CreditBatch";
DROP POLICY IF EXISTS flownana_server_all ON public."Generation";
DROP POLICY IF EXISTS flownana_server_all ON public."MediaAsset";
DROP POLICY IF EXISTS flownana_server_all ON public."GenerationMedia";
DROP POLICY IF EXISTS flownana_server_all ON public."ProcessedStripeEvent";
DROP POLICY IF EXISTS flownana_server_all ON public."MediaUploadGrant";

ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CreditBatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Generation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MediaAsset" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."GenerationMedia" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."ProcessedStripeEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MediaUploadGrant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_prisma_migrations" DISABLE ROW LEVEL SECURITY;

GRANT ALL PRIVILEGES ON TABLE
  public."User", public."Subscription", public."CreditBatch",
  public."Generation", public."MediaAsset", public."GenerationMedia",
  public."ProcessedStripeEvent", public."_prisma_migrations"
TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
```

Re-enable the Data API only if the previous release requires it. Do not drop
`MediaUploadGrant` or `flownana_app` during an incident rollback; remove them
later only after confirming no deployed release or retained upload depends on
them.
