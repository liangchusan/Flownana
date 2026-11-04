import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { isolatedTestDatabase } from "./helpers/test-database.ts";
import { createSourceLoader } from "./helpers/load-source.ts";
import { SIGNUP_IP_WINDOW_MS, SIGNUP_BONUS_LIFETIME_MS } from "../lib/signup-bonus-policy.ts";
import { TEST_GA_ID } from "../lib/analytics-policy.ts";

const databaseUrl = process.env.FLOWNANA_TEST_DATABASE_URL;
test("signup bonus: actual PostgreSQL eligibility, ledger, concurrency and permissions", { skip: !databaseUrl }, async t => {
  const db = isolatedTestDatabase(databaseUrl!);
  const previous = { ...process.env }, ids: string[] = [], hashes: string[] = [];
  process.env.NEXT_PUBLIC_GA_ENABLED = "false";
  const clock = Date.now();
  t.mock.timers.enable({ apis: ["Date"], now: clock });
  t.beforeEach(() => t.mock.timers.setTime(clock));
  t.after(async () => {
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.signupIpWindow.deleteMany({ where: { ipHash: { in: hashes } } });
    await db.$disconnect();
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  });
  const load = createSourceLoader({ "@/lib/prisma": { prisma: db }, "next/server": { after() {} } });
  const users = load<typeof import("../lib/user-sync")>("lib/user-sync.ts");
  const bonus = load<typeof import("../lib/signup-bonus")>("lib/signup-bonus.ts");
  const credits = load<typeof import("../lib/credits")>("lib/credits.ts");
  function evidence(country: string | null = "US") {
    const ipHash = createHash("sha256").update(randomUUID()).digest("hex"); hashes.push(ipHash);
    return { ipHash, country };
  }
  function input(signupBonus?: { ipHash: string | null; country: string | null }) {
    const id = `signup_test_${randomUUID()}`; ids.push(id);
    return { id, email: `${id}@example.test`, name: "Fixture", signupBonus };
  }
  const batches = (id: string) => db.creditBatch.findMany({ where: { userId: id } });
  const reason = async (id: string) => (await db.signupBonusDecision.findUniqueOrThrow({ where: { userId: id } })).reason;

  await t.test("seven countries receive 10 credits once; other and unknown regions still register", async () => {
    for (const country of ["US", "JP", "KR", "TW", "DE", "FR", "GB", "CN", "HK", "CA", null]) {
      const p = input(evidence(country));
      await users.upsertAppUser(p);
      const eligible = country !== null && ["US", "JP", "KR", "TW", "DE", "FR", "GB"].includes(country);
      assert.equal((await credits.getCreditSummary(p.id)).total, eligible ? 10 : 0);
      assert.equal(await reason(p.id), eligible ? "granted" : "country_ineligible");
      assert.equal(await db.signupIpWindow.count({ where: { ipHash: p.signupBonus!.ipHash! } }), 1);
      await users.upsertAppUser(p);
      assert.equal((await batches(p.id)).length, eligible ? 1 : 0);
    }
  });

  await t.test("same IP first registration wins; denied attempts do not extend its 72-hour window", async () => {
    t.mock.timers.setTime(clock);
    const e = evidence(), first = input(e);
    await users.upsertAppUser(first);
    const window = await db.signupIpWindow.findUniqueOrThrow({ where: { ipHash: e.ipHash } });
    assert.equal(window.expiresAt.getTime() - window.startedAt.getTime(), SIGNUP_IP_WINDOW_MS);
    t.mock.timers.setTime(clock + SIGNUP_IP_WINDOW_MS - 1);
    const second = input(e); await users.upsertAppUser(second);
    assert.equal(await reason(second.id), "ip_limit");
    assert.deepEqual(await db.signupIpWindow.findUniqueOrThrow({ where: { ipHash: e.ipHash } }), window);
    t.mock.timers.setTime(clock + SIGNUP_IP_WINDOW_MS);
    const third = input(e); await users.upsertAppUser(third);
    assert.equal(await reason(third.id), "granted");
    assert.equal((await db.signupIpWindow.findUniqueOrThrow({ where: { ipHash: e.ipHash } })).startedAt.getTime(), clock + SIGNUP_IP_WINDOW_MS);
    t.mock.timers.setTime(clock + 2 * SIGNUP_IP_WINDOW_MS + 1);
    assert.equal(await reason((await users.upsertAppUser(input(e))).id), "granted");
    t.mock.timers.setTime(clock);
  });

  await t.test("ineligible or unknown first registration consumes the window; missing IP never backfills", async () => {
    for (const country of ["CN", null]) {
      const e = evidence(country); await users.upsertAppUser(input(e));
      const next = input({ ...e, country: "US" }); await users.upsertAppUser(next);
      assert.equal(await reason(next.id), "ip_limit");
    }
    const missing = input({ ipHash: null, country: "US" });
    await users.upsertAppUser(missing);
    assert.equal(await reason(missing.id), "source_unavailable");
    const e = evidence(); await users.upsertAppUser({ ...missing, signupBonus: e });
    assert.equal((await batches(missing.id)).length, 0);
    assert.equal(await db.signupIpWindow.count({ where: { ipHash: e.ipHash } }), 0);
  });

  await t.test("same-IP concurrent accounts and repeated callbacks each have exactly one winner", async () => {
    const e = evidence(), inputs = Array.from({ length: 10 }, () => input(e));
    await Promise.all(inputs.map(p => users.upsertAppUser(p)));
    assert.equal(await db.creditBatch.count({ where: { userId: { in: inputs.map(p => p.id) } } }), 1);
    assert.equal(await db.signupBonusDecision.count({ where: { userId: { in: inputs.map(p => p.id) }, reason: "ip_limit" } }), 9);
    const replay = input(evidence());
    await Promise.all(Array.from({ length: 8 }, () => users.upsertAppUser(replay)));
    assert.equal((await batches(replay.id)).length, 1);
    assert.equal(await db.signupBonusDecision.count({ where: { userId: replay.id } }), 1);
    await assert.rejects(db.creditBatch.create({ data: { userId: replay.id, source: "signup-bonus", amount: 10, remaining: 10, expiresAt: new Date(clock + 1000) } }), /Unique constraint/);
  });

  await t.test("old accounts and test registrations never get gifts or consume IP slots", async () => {
    const old = input(evidence()); await db.user.create({ data: { id: old.id, email: old.email } });
    await users.upsertAppUser(old);
    assert.equal(await db.signupBonusDecision.count({ where: { userId: old.id } }), 0);
    const testUser = input(); await users.upsertAppUser(testUser);
    assert.equal((await batches(testUser.id)).length, 0);
    assert.equal(await db.signupBonusDecision.count({ where: { userId: testUser.id } }), 0);
    assert.equal(await db.signupIpWindow.count({ where: { ipHash: old.signupBonus!.ipHash! } }), 0);
  });

  await t.test("account deletion does not release the IP window, even with the same identity", async () => {
    const e = evidence(), p = input(e); await users.upsertAppUser(p);
    await db.user.delete({ where: { id: p.id } });
    assert.equal(await db.signupBonusDecision.count({ where: { userId: p.id } }), 0);
    await users.upsertAppUser(p);
    assert.equal(await reason(p.id), "ip_limit");
    assert.equal((await batches(p.id)).length, 0);
  });

  await t.test("an error after ledger creation rolls back account, IP slot, decision and credits together", async () => {
    const e = evidence(), p = input(e);
    const broken = createSourceLoader({ "@/lib/prisma": { prisma: db }, "@/lib/analytics-server": {
      serverMeasurementId: () => "fixture", queueAnalyticsReport: async () => { throw new Error("fixture unavailable"); },
    } })<typeof users>("lib/user-sync.ts");
    await assert.rejects(broken.upsertAppUser(p), /fixture unavailable/);
    assert.equal(await db.user.count({ where: { id: p.id } }), 0);
    assert.equal(await db.signupIpWindow.count({ where: { ipHash: e.ipHash } }), 0);
    assert.equal((await batches(p.id)).length, 0);
    await users.upsertAppUser(p); assert.equal(await reason(p.id), "granted");
  });

  await t.test("signup gift is independent of GA consent; real signup facts still deduplicate", async () => {
    Object.assign(process.env, { NEXT_PUBLIC_GA_ENABLED: "true", NEXT_PUBLIC_GA_MEASUREMENT_ID: TEST_GA_ID,
      VERCEL_ENV: "preview", GA_API_SECRET: "signup_test_transport_fixture" });
    try {
      for (const allowed of [true, false]) {
        const p = { ...input(evidence()), analyticsContext: allowed ? {
          clientId: "123.456", sessionId: 1793000000, capturedAt: clock, measurementId: TEST_GA_ID,
        } : null };
        await users.upsertAppUser(p); await users.upsertAppUser(p);
        assert.equal(await reason(p.id), "granted");
        const facts = await db.analyticsReport.findMany({ where: { userId: p.id } });
        assert.equal(facts.length, 1); assert.equal(facts[0].name, "sign_up");
        assert.deepEqual(facts[0].params, { method: "google" });
        assert.equal(facts[0].status, allowed ? "pending" : "missing_context");
        assert.ok(!JSON.stringify(facts).includes(p.signupBonus!.ipHash!));
      }
    } finally { process.env.NEXT_PUBLIC_GA_ENABLED = "false"; }
  });

  await t.test("actual Google signIn callback reads server headers, while test login never participates", async () => {
    Object.assign(process.env, { NODE_ENV: "production", VERCEL: "1", VERCEL_ENV: "preview",
      SIGNUP_BONUS_IP_HASH_SECRET: "signup_callback_test_fixture_0123456789",
      GOOGLE_CLIENT_ID: "fixture", GOOGLE_CLIENT_SECRET: "GOCSPX-fixture" });
    const h = new Headers({ "x-vercel-forwarded-for": "8.8.4.4", "x-vercel-ip-country": "US" });
    const policy = load<typeof import("../lib/signup-bonus-policy")>("lib/signup-bonus-policy.ts");
    hashes.push(policy.signupBonusEvidence(h).ipHash!);
    const auth = createSourceLoader({ "@/lib/prisma": { prisma: db }, "next/server": { after() {} },
      "next-auth": () => null,
      "next/headers": { headers: async () => h, cookies: async () => ({ get: () => undefined }) },
    })<typeof import("../lib/auth-options")>("lib/auth-options.ts");
    const callback = auth.authOptions.callbacks!.signIn!;
    const call = async (provider: string, p: ReturnType<typeof input>) => callback({
      user: { id: p.id, email: p.email, name: p.name },
      account: { provider, type: "oauth", providerAccountId: p.id },
      profile: { sub: p.id, email_verified: true } as { sub: string; email_verified: boolean },
    });
    const first = input(); assert.equal(await call("google", first), true); assert.equal(await reason(first.id), "granted");
    assert.equal(await call("google", first), true); assert.equal((await batches(first.id)).length, 1);
    const second = input(); assert.equal(await call("google", second), true); assert.equal(await reason(second.id), "ip_limit");
    const testUser = input(); assert.equal(await call("test-login", testUser), true);
    assert.equal(await db.signupBonusDecision.count({ where: { userId: testUser.id } }), 0);
    h.delete("x-vercel-forwarded-for"); h.set("x-forwarded-for", "1.1.1.1");
    const forged = input(); assert.equal(await call("google", forged), true); assert.equal(await reason(forged.id), "source_unavailable");
  });

  await t.test("legacy profile fallback preserves the transaction and the restricted server role can award", async () => {
    const p = input(evidence()); let first = true;
    const fallback = createSourceLoader({ "@/lib/prisma": { prisma: {
      user: { findUnique: async (args: Parameters<typeof db.user.findUnique>[0]) => {
        if (first) { first = false; throw Object.assign(new Error("fixture missing profile column"), { code: "P2022" }); }
        return db.user.findUnique(args);
      } },
      $transaction: db.$transaction.bind(db),
    } } })<typeof users>("lib/user-sync.ts");
    await fallback.upsertAppUser(p); assert.equal(await reason(p.id), "granted");
    const server = input(evidence());
    await db.$transaction(async tx => {
      await tx.$executeRawUnsafe("SET LOCAL ROLE flownana_app");
      await tx.user.create({ data: { id: server.id, email: server.email } });
      await bonus.awardSignupBonus(tx, server.id, server.signupBonus!);
    });
    assert.equal(await reason(server.id), "granted");
  });

  await t.test("gift batch works with existing FIFO debit/refund and expires at 30 days", async () => {
    const p = input(evidence()); await users.upsertAppUser(p);
    const [batch] = await batches(p.id);
    assert.equal(batch.amount, 10); assert.equal(batch.remaining, 10); assert.equal(batch.source, "signup-bonus");
    assert.equal(batch.expiresAt.getTime(), clock + SIGNUP_BONUS_LIFETIME_MS);
    const consumption = load<typeof import("../lib/credit-consumption")>("lib/credit-consumption.ts");
    const snapshot = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${p.id} FOR UPDATE`;
      return consumption.consumeCreditsFIFOWithClient(tx, p.id, 3);
    });
    assert.equal((await credits.getCreditSummary(p.id)).total, 7);
    await db.$transaction(tx => consumption.refundConsumedCreditsWithClient(tx, snapshot, p.id));
    assert.equal((await credits.getCreditSummary(p.id)).total, 10);
    t.mock.timers.setTime(clock + SIGNUP_BONUS_LIFETIME_MS - 1);
    assert.equal((await credits.getCreditSummary(p.id)).total, 10);
    t.mock.timers.setTime(clock + SIGNUP_BONUS_LIFETIME_MS);
    assert.equal((await credits.getCreditSummary(p.id)).total, 0);
    await assert.rejects(db.$transaction(tx => consumption.consumeCreditsFIFOWithClient(tx, p.id, 1)), /Insufficient credits/);
    t.mock.timers.setTime(clock);
  });

  await t.test("cleanup removes only expired hashes; private tables deny API roles and allow server role", async () => {
    const p = input(evidence()); await users.upsertAppUser(p);
    const before = await db.signupIpWindow.count();
    assert.equal((await bonus.cleanupSignupIpWindows(new Date(clock - 1))).count, 0);
    assert.ok((await bonus.cleanupSignupIpWindows(new Date(clock + SIGNUP_IP_WINDOW_MS))).count > 0);
    assert.ok(await db.signupIpWindow.count() < before);
    for (const role of ["anon", "authenticated", "service_role"]) {
      for (const table of ["SignupIpWindow", "SignupBonusDecision"]) {
        await assert.rejects(db.$transaction(async tx => {
          await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
          await tx.$queryRawUnsafe(`SELECT * FROM "${table}"`);
        }), /permission denied/);
      }
    }
    await db.$transaction(async tx => {
      await tx.$executeRawUnsafe("SET LOCAL ROLE flownana_app");
      assert.ok(await tx.signupBonusDecision.count() > 0);
      const e = evidence();
      await tx.signupIpWindow.create({ data: { ipHash: e.ipHash, startedAt: new Date(clock), expiresAt: new Date(clock + SIGNUP_IP_WINDOW_MS) } });
      await tx.signupIpWindow.delete({ where: { ipHash: e.ipHash } });
    });
    const rows = await db.$queryRaw<Array<{ relrowsecurity: boolean }>>`SELECT relrowsecurity FROM pg_class WHERE relname IN ('SignupIpWindow', 'SignupBonusDecision')`;
    assert.equal(rows.length, 2); assert.ok(rows.every(row => row.relrowsecurity));
  });
});
