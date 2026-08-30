import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../prisma/migrations/20260830035253_harden_public_data_api_access/migration.sql",
    import.meta.url
  ),
  "utf8"
);

const protectedTables = [
  "User",
  "Subscription",
  "CreditBatch",
  "Generation",
  "MediaAsset",
  "GenerationMedia",
  "ProcessedStripeEvent",
  "MediaUploadGrant",
  "_prisma_migrations",
];

test("all core tables enable RLS and lose browser Data API privileges", () => {
  const tableRevoke = migration.match(
    /REVOKE ALL PRIVILEGES ON TABLE([\s\S]*?)FROM PUBLIC, anon, authenticated, service_role;/
  );
  assert.ok(tableRevoke, "the table privilege revoke must exist");

  for (const table of protectedTables) {
    assert.match(
      migration,
      new RegExp(
        `ALTER TABLE public\\."${table}" ENABLE ROW LEVEL SECURITY;`
      ),
      `${table} must enable RLS`
    );
    assert.match(
      tableRevoke[1],
      new RegExp(`public\\."${table}"`),
      `${table} must be included in the table privilege revoke`
    );
  }
});

test("future postgres-owned public objects default to no browser access", () => {
  assert.match(
    migration,
    /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public[\s\S]*REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated, service_role;/
  );
  assert.match(
    migration,
    /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public[\s\S]*REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;/
  );
  assert.match(
    migration,
    /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public[\s\S]*REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;/
  );
});

test("only the dedicated server role receives policies and migration metadata stays isolated", () => {
  assert.doesNotMatch(migration, /TO\s+(anon|authenticated|service_role)/i);
  assert.match(migration, /CREATE ROLE flownana_app[\s\S]*NOBYPASSRLS/);
  assert.doesNotMatch(migration, /ALTER ROLE flownana_app[^;]*(SUPERUSER|BYPASSRLS)/i);
  assert.doesNotMatch(migration, /REVOKE EXECUTE ON ALL FUNCTIONS/);
  assert.match(migration, /CREATE POLICY flownana_server_all[\s\S]*TO flownana_app/);
  const appGrant = migration.match(/GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE([\s\S]*?)TO flownana_app;/);
  assert.ok(appGrant);
  assert.doesNotMatch(appGrant[1], /_prisma_migrations/);
  assert.doesNotMatch(migration, /FORCE\s+ROW\s+LEVEL\s+SECURITY/i);
});
