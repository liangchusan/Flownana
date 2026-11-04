import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { isolatedTestDatabase } from "./helpers/test-database.ts";
import { createSourceLoader } from "./helpers/load-source.ts";
import { getAccountScope, ACCOUNT_SCOPE_HEADER } from "../lib/account-scope.ts";
import { TEST_GA_ID } from "../lib/analytics-policy.ts";

const databaseUrl = process.env.FLOWNANA_TEST_DATABASE_URL;
test("security repairs: actual PostgreSQL ownership, concurrency, parser leases and RLS", { skip: !databaseUrl }, async t => {
  const db = isolatedTestDatabase(databaseUrl!);
  const ids: string[] = [];
  t.after(async () => { await db.user.deleteMany({ where: { id: { in: ids } } }); await db.$disconnect(); });
  async function user() {
    const id = `security_test_${randomUUID()}`; ids.push(id);
    const row = await db.user.create({ data: { id, email: `${id}@example.test`, providerImage: "https://provider.test/photo" } });
    return { ...row, accountCreatedAt: row.createdAt.toISOString() };
  }
  const json = (body: unknown, init?: ResponseInit) => {
    const r = Response.json(body, init) as any;
    r.cookies = { set: (key: string, value: string) => r.headers.set("set-cookie", `${key}=${value}; Path=/; HttpOnly`), delete: () => r.headers.set("set-cookie", "flownana_analytics=; Max-Age=0") };
    return r;
  };
  const boundary = { "@/lib/prisma": { prisma: db }, "@/lib/auth-options": { authOptions: {} }, "next/server": { NextResponse: { json }, after() {} } };

  await t.test("same claimed GA ID gives no cross-browser withdrawal authority, including after logout", async () => {
    Object.assign(process.env, { VERCEL_ENV: "preview", NEXT_PUBLIC_GA_ENABLED: "true", NEXT_PUBLIC_GA_MEASUREMENT_ID: TEST_GA_ID, NEXTAUTH_SECRET: "isolated_security_context_fixture" });
    const a = await user(), b = await user(); let session: any = { user: a };
    const load = createSourceLoader({ ...boundary, "next-auth": { getServerSession: async () => session } });
    const api = load<any>("app/api/analytics/context/route.ts"), reports = load<any>("lib/analytics-server.ts");
    const post = (cookie?: string) => api.POST(new Request("http://localhost/api/analytics/context", { method: "POST", headers: { origin: "http://localhost", [ACCOUNT_SCOPE_HEADER]: getAccountScope(session.user)!, ...(cookie ? { cookie } : {}) },
      body: JSON.stringify({ clientId: "111.222", sessionId: 12345, measurementId: TEST_GA_ID, capturedAt: Date.now(), withdrawalToken: "a".repeat(64) }) }));
    const cookieA = (await post()).headers.get("set-cookie")!.split(";")[0];
    const contextA = reports.contextFromRequest(new Request("http://localhost", { headers: { cookie: cookieA } }));
    assert.notEqual(contextA.withdrawalToken, "a".repeat(64));
    const refreshed = (await post(cookieA)).headers.get("set-cookie")!.split(";")[0];
    assert.equal(reports.contextFromRequest(new Request("http://localhost", { headers: { cookie: refreshed } })).withdrawalToken, contextA.withdrawalToken);
    session = { user: b };
    const cookieB = (await post()).headers.get("set-cookie")!.split(";")[0];
    const contextB = reports.contextFromRequest(new Request("http://localhost", { headers: { cookie: cookieB } }));
    assert.notEqual(contextA.withdrawalToken, contextB.withdrawalToken);
    for (const [u, context] of [[a, contextA], [b, contextB]] as const) {
      await db.$transaction(tx => reports.queueAnalyticsReport(tx, { userId: u.id, key: u.id, name: "generation_completed", context, params: {} }));
    }
    await db.analyticsReport.create({ data: { id: `sent:${a.id}`, userId: a.id, environment: "test", name: "purchase", params: {}, context: contextA, status: "transmitted", occurredAt: new Date(), nextAttemptAt: new Date() } });
    session = null;
    const withdraw = (cookie: string) => api.DELETE(new Request("http://localhost/api/analytics/context", { method: "DELETE", headers: { origin: "http://localhost", cookie } }));
    assert.equal((await withdraw(cookieB)).status, 200);
    assert.equal(await db.analyticsContext.count({ where: { userId: a.id } }), 1);
    assert.equal((await db.analyticsReport.findFirstOrThrow({ where: { userId: a.id, name: "generation_completed" } })).status, "pending");
    assert.equal((await db.analyticsReport.findFirstOrThrow({ where: { userId: b.id } })).status, "revoked");
    assert.equal((await withdraw(refreshed)).status, 200);
    assert.equal(await db.analyticsContext.count({ where: { userId: a.id } }), 0);
    assert.equal((await db.analyticsReport.findUniqueOrThrow({ where: { id: `sent:${a.id}` } })).status, "transmitted");
  });

  await t.test("concurrent avatar POSTs and DELETE serialize selection, preserve provider fallback and retain cleanup intent", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "isolated_storage_fixture";
    const a = await user(), blobs = new Set<string>(); let first = true, release!: () => void, secondWritten!: () => void;
    const second = new Promise<void>(resolve => { secondWritten = resolve; });
    const load = createSourceLoader({ ...boundary, "next-auth": { getServerSession: async () => ({ user: a }) },
      "@vercel/blob": { put: async (pathname: string) => {
        assert.ok(await db.mediaUploadGrant.findFirst({ where: { userId: a.id, blobUrl: pathname } }), "intent must commit before storage write");
        const url = `https://fixture.public.blob.vercel-storage.com/${pathname}`; blobs.add(url);
        if (first) { first = false; await new Promise<void>(resolve => { release = resolve; }); } else secondWritten();
        return { url };
      }, del: async (url: string) => { blobs.delete(url); } },
    });
    const api = load<any>("app/api/account/avatar/route.ts");
    const upload = () => { const form = new FormData(); form.set("avatar", new File([Buffer.from("image")], "x.png", { type: "image/png" })); return api.POST(new Request("http://localhost/api/account/avatar", { method: "POST", headers: { [ACCOUNT_SCOPE_HEADER]: getAccountScope(a)! }, body: form })); };
    const p1 = upload(); while (first) await new Promise(resolve => setTimeout(resolve, 1));
    const deletion = load<any>("app/api/account/route.ts");
    const rejected = await deletion.DELETE(new Request("http://localhost/api/account", { method: "DELETE", headers: { [ACCOUNT_SCOPE_HEADER]: getAccountScope(a)! }, body: JSON.stringify({ confirmation: "DELETE" }) }));
    assert.equal(rejected.status, 409); assert.equal((await rejected.json()).code, "avatar_upload_pending");
    const p2 = upload(); await second;
    assert.equal((await p2).status, 200); release(); assert.equal((await p1).status, 200);
    const current = await db.user.findUniqueOrThrow({ where: { id: a.id } });
    assert.deepEqual([...blobs], [current.customAvatarUrl]);
    assert.equal(await db.mediaUploadGrant.count({ where: { userId: a.id, kind: "avatar", completedAt: { not: null } } }), 2);
    const removed = await api.DELETE(new Request("http://localhost/api/account/avatar", { method: "DELETE", headers: { [ACCOUNT_SCOPE_HEADER]: getAccountScope(a)! } }));
    assert.equal(removed.status, 200); assert.equal(blobs.size, 0);
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: a.id } })).image, a.providerImage);
    assert.equal(await db.mediaUploadGrant.count({ where: { userId: a.id, kind: "avatar", actualBytes: 0 } }), 2);
  });

  await t.test("confirmed avatar deletion releases storage quota while preserving daily attempt and byte accounting", async () => {
    const a = await user(), reserve = createSourceLoader(boundary)<any>("lib/upload-reservation.ts");
    const old = new Date(Date.now() - 2 * 86400_000);
    await db.mediaUploadGrant.createMany({ data: Array.from({ length: 3 }, () => ({ id: randomUUID(), userId: a.id, kind: "avatar", maxBytes: 2_000_000_000, actualBytes: 0, completedAt: old, createdAt: old, expiresAt: old })) });
    await reserve.reserveMediaUpload(a.id, { uploadId: randomUUID(), kind: "image", sizeBytes: 1024 }, a.accountCreatedAt);
    // Deleted files still count towards the current day's byte reservation.
    await db.mediaUploadGrant.create({ data: { id: randomUUID(), userId: a.id, kind: "avatar", maxBytes: 1024 ** 3, actualBytes: 0, completedAt: new Date(), expiresAt: new Date() } });
    await assert.rejects(reserve.reserveMediaUpload(a.id, { uploadId: randomUUID(), kind: "image", sizeBytes: 1 }, a.accountCreatedAt), /quota/);
  });

  await t.test("avatar and reference reservations cannot race past their shared upload quota", async () => {
    const a = await user(), reserve = createSourceLoader(boundary)<any>("lib/upload-reservation.ts");
    await db.mediaUploadGrant.createMany({ data: Array.from({ length: 59 }, () => ({ id: randomUUID(), userId: a.id, kind: "image", maxBytes: 1, expiresAt: new Date(Date.now() + 60_000) })) });
    const attempts = await Promise.allSettled(["avatar", "image"].map(kind => reserve.reserveMediaUpload(a.id, { uploadId: randomUUID(), kind, sizeBytes: 1 }, a.accountCreatedAt)));
    assert.equal(attempts.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(await db.mediaUploadGrant.count({ where: { userId: a.id } }), 60);
    await assert.rejects(reserve.reserveMediaUpload(a.id, { uploadId: randomUUID(), kind: "image", sizeBytes: 1 }, "2000-01-01T00:00:00.000Z"), /Account changed/);
  });

  await t.test("avatar cleanup recovers quota even when Blob deletion succeeded before a failed database update", async () => {
    const a = await user(), url = `https://fixture.public.blob.vercel-storage.com/avatars/${a.id}/old.png`;
    const old = new Date(Date.now() - 2 * 86400_000);
    const grant = await db.mediaUploadGrant.create({ data: { id: randomUUID(), userId: a.id, kind: "avatar", maxBytes: 123, actualBytes: 123, blobUrl: url, createdAt: old, completedAt: old, expiresAt: old } });
    let unavailable = true, calls = 0;
    const cleaner = createSourceLoader({ ...boundary, "@vercel/blob": {
      list: async () => ({ blobs: [], hasMore: false }), del: async (target: string) => { assert.equal(target, url); calls++; if (unavailable) throw new Error("storage unavailable"); },
    } })<any>("lib/media-upload-cleanup.ts");
    await assert.rejects(cleaner.cleanupOrphanedMediaUploads(), /storage unavailable/);
    assert.equal((await db.mediaUploadGrant.findUniqueOrThrow({ where: { id: grant.id } })).actualBytes, 123);
    unavailable = false; await cleaner.cleanupOrphanedMediaUploads();
    assert.equal(await db.mediaUploadGrant.findUnique({ where: { id: grant.id } }), null);
    assert.equal(calls, 2);
  });

  await t.test("all inspection callers share durable account leases and failed parses retain attempt accounting", async () => {
    const a = await user(), account = { id: a.id, accountCreatedAt: a.accountCreatedAt };
    const budget = createSourceLoader(boundary)<any>("lib/media-inspection-budget.ts");
    let release!: () => void;
    const hold = new Promise<void>(resolve => { release = resolve; });
    let started = 0;
    const p1 = budget.withMediaInspection(account, async () => { started++; await hold; return true; });
    const p2 = budget.withMediaInspection(account, async () => { started++; await hold; return true; });
    while (started < 2) await new Promise(resolve => setTimeout(resolve, 1));
    await assert.rejects(budget.withMediaInspection(account, async () => true), /Too many/);
    release(); await Promise.all([p1, p2]);
    await assert.rejects(budget.withMediaInspection(account, async () => { throw new Error("bad media"); }), /bad media/);
    assert.equal(await db.mediaUploadGrant.count({ where: { userId: a.id, kind: "inspection", completedAt: { not: null } } }), 3);
    await db.mediaUploadGrant.createMany({ data: Array.from({ length: 57 }, () => ({ id: randomUUID(), userId: a.id, kind: "inspection", maxBytes: 0, expiresAt: new Date(), completedAt: new Date() })) });
    await assert.rejects(budget.withMediaInspection(account, async () => true), /Too many/);
  });

  await t.test("new compatibility tables have RLS and deny all Data API roles", async () => {
    for (const table of ["CheckoutHistoryMigration", "LegacyCheckout"]) {
      const rows = await db.$queryRaw<Array<{ enabled: boolean }>>`SELECT relrowsecurity AS enabled FROM pg_class WHERE oid = ${`public."${table}"`}::regclass`;
      assert.equal(rows[0].enabled, true);
      for (const role of ["anon", "authenticated", "service_role"]) for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
        const access = await db.$queryRaw<Array<{ allowed: boolean }>>`SELECT has_table_privilege(${role}, ${`public."${table}"`}, ${privilege}) AS allowed`;
        assert.equal(access[0].allowed, false);
      }
    }
    await db.$transaction(async tx => {
      await tx.$executeRawUnsafe("SET LOCAL ROLE flownana_app");
      assert.ok(await tx.checkoutHistoryMigration.findUnique({ where: { id: "legacy-checkouts-v1" } }));
      const id = `role_test_${randomUUID()}`;
      await tx.legacyCheckout.create({ data: { id, userId: "isolated_role_fixture", createdAt: new Date() } });
      await tx.legacyCheckout.update({ where: { id }, data: { reservationId: "fixture" } });
      assert.equal((await tx.legacyCheckout.findUniqueOrThrow({ where: { id } })).reservationId, "fixture");
      await tx.legacyCheckout.delete({ where: { id } });
    });
  });

  await t.test("legacy Checkout import checkpoints pages, survives provider failure and freezes its cutoff", async () => {
    const id = "legacy-checkouts-v1", owner = await user();
    // Isolate the migration cursor from other database suites running in parallel.
    const schema = `security_import_${randomUUID().replaceAll("-", "")}`;
    await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    for (const table of ["CheckoutHistoryMigration", "LegacyCheckout"]) await db.$executeRawUnsafe(`CREATE TABLE "${schema}"."${table}" (LIKE public."${table}" INCLUDING ALL)`);
    const importUrl = new URL(databaseUrl!); importUrl.searchParams.set("schema", schema);
    const importDb = isolatedTestDatabase(importUrl.toString());
    await importDb.checkoutHistoryMigration.create({ data: { id } });
    const rows = Array.from({ length: 205 }, (_, i) => ({ id: `cs_import_${owner.id}_${i}`, mode: "subscription", client_reference_id: owner.id,
      created: Math.floor(Date.now() / 1000) - i - 1, metadata: { userId: owner.id, accountCreatedAt: owner.accountCreatedAt } }));
    let fail = false; const bounds: number[] = [];
    const stripe = { checkout: { sessions: { list: async (filter: any) => {
      bounds.push(filter.created.lt);
      if (fail) throw new Error("provider offline");
      const start = filter.starting_after ? rows.findIndex(r => r.id === filter.starting_after) + 1 : 0;
      return { data: rows.slice(start, start + 100), has_more: start + 100 < rows.length };
    } } } };
    const importer = createSourceLoader({})<any>("lib/checkout-history-migration.ts");
    try {
      assert.deepEqual(await importer.importCheckoutHistoryPage(importDb, stripe), { complete: false, imported: 100 });
      const state = await importDb.checkoutHistoryMigration.findUniqueOrThrow({ where: { id } });
      fail = true; await assert.rejects(importer.importCheckoutHistoryPage(importDb, stripe), /provider offline/);
      assert.equal((await importDb.checkoutHistoryMigration.findUniqueOrThrow({ where: { id } })).cursor, state.cursor);
      fail = false;
      assert.deepEqual(await importer.importCheckoutHistoryPage(importDb, stripe), { complete: false, imported: 100 });
      assert.deepEqual(await importer.importCheckoutHistoryPage(importDb, stripe), { complete: true, imported: 5 });
      assert.deepEqual(await importer.importCheckoutHistoryPage(importDb, stripe), { complete: true, imported: 0 });
      assert.equal(new Set(bounds).size, 1); assert.equal(await importDb.legacyCheckout.count({ where: { userId: owner.id } }), 205);
    } finally {
      await importDb.$disconnect();
      await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    }
  });
});
