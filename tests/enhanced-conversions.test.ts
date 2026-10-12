import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { createSourceLoader } from "./helpers/load-source.ts";
import { TEST_GA_ID } from "../lib/analytics-policy.ts";
import { ACCOUNT_SCOPE_HEADER, getAccountScope } from "../lib/account-scope.ts";

test("enhanced conversions: real API/queue/worker source with isolated storage and transport boundaries", async t => {
  const previous = { ...process.env };
  Object.assign(process.env, { NEXT_PUBLIC_GA_ENABLED: "true", NEXT_PUBLIC_GA_ENHANCED_CONVERSIONS_ENABLED: "true",
    NEXT_PUBLIC_GA_MEASUREMENT_ID: TEST_GA_ID, NEXTAUTH_SECRET: "local_fixture_secret", GA_API_SECRET: "fixture", VERCEL_ENV: "preview" });
  t.after(() => { for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key]; Object.assign(process.env, previous); });
  const user = { id: "fixture-account", email: "Fixture.Test@gmail.com", createdAt: new Date(Date.now() - 10000) };
  const contexts = new Map<string, any>(), facts = new Map<string, any>();
  const matches = (row: any, where: any): boolean => Object.entries(where).every(([key, value]: any) => {
    if (key === "OR") return value.some((condition: any) => matches(row, condition));
    if (key === "context") return row.context?.[value.path[0]] === value.equals;
    if (value?.in) return value.in.includes(row[key]);
    if (value?.lte) return row[key] <= value.lte;
    if (value?.lt) return row[key] < value.lt;
    if (value instanceof Date) return row[key]?.getTime() === value.getTime();
    return row[key] === value;
  });
  const db: any = { $queryRaw: async (parts: TemplateStringsArray) => {
    const sql = parts.join("?");
    if (/^SELECT pg_advisory_xact_lock/.test(sql)) throw new Error("Prisma cannot deserialize void");
    return sql.includes("pg_advisory_xact_lock") ? [{ locked: 1 }] : [];
  }, user: { findUnique: async () => user },
    analyticsContext: {
      findUnique: async ({ where }: any) => contexts.get(where.id) ?? null,
      upsert: async ({ where, create, update }: any) => { const row = contexts.has(where.id) ? { ...contexts.get(where.id), ...update } : create; contexts.set(where.id, row); return row; },
      deleteMany: async ({ where }: any) => { for (const [key, row] of contexts) if (matches(row, where)) contexts.delete(key); },
    }, analyticsReport: {
      findUnique: async ({ where }: any) => facts.get(where.id) ?? null,
      createMany: async ({ data }: any) => { if (facts.has(data.id)) return { count: 0 }; facts.set(data.id, { ...data, attempts: 0, leaseUntil: null }); return { count: 1 }; },
      findMany: async ({ where }: any) => [...facts.values()].filter(row => matches(row, where)).map(row => structuredClone(row)),
      updateMany: async ({ where, data }: any) => { let count = 0; for (const row of facts.values()) if (matches(row, where)) {
        count++; for (const [key, value] of Object.entries(data) as any) row[key] = value?.increment ? row[key] + value.increment : value;
      } return { count }; },
    } };
  db.$transaction = async (work: any) => work(db);
  let session: any = { user: { id: user.id, accountCreatedAt: user.createdAt.toISOString(), email: user.email, emailVerified: true } };
  let sessionWait: Promise<any> | null = null;
  const source = createSourceLoader({ "@/lib/prisma": { prisma: db }, "@/lib/auth-options": { authOptions: {} },
    "next-auth": { getServerSession: async () => sessionWait ? await sessionWait : session }, "next/server": { after() {}, NextResponse: { json: Response.json } } });
  const policy = source<typeof import("../lib/enhanced-conversions")>("lib/enhanced-conversions.ts");
  const reports = source<typeof import("../lib/analytics-server")>("lib/analytics-server.ts");
  const api = source<typeof import("../app/api/analytics/advertising/route")>("app/api/analytics/advertising/route.ts");
  const context = { clientId: "123.456", sessionId: 1791160000, capturedAt: Date.now(), measurementId: TEST_GA_ID, collectionBasis: "explicit" as const };
  await reports.saveAnalyticsContext(db, user, context);
  const headers = { origin: "http://localhost", "Content-Type": "application/json", [ACCOUNT_SCOPE_HEADER]: getAccountScope(session.user)!,
    cookie: `flownana_analytics=${reports.signAnalyticsContext(context)}` };
  const request = (method: string, body: unknown, extra: any = {}) => new Request("http://localhost/api/analytics/advertising", {
    method, headers: { ...headers, ...extra }, ...(method !== "GET" ? { body: JSON.stringify(body) } : {}) });
  const grant = async () => {
    // A new user action is later than the prior withdrawal's millisecond boundary.
    await new Promise(resolve => setTimeout(resolve, 2));
    const response = await api.POST(request("POST", { storage: true, userData: true })); assert.equal(response.status, 200); return response.json();
  };
  const queue = (key: string, occurredAt = new Date(), name: "purchase" | "sign_up" = "purchase") => reports.queueAnalyticsReport(db, {
    userId: user.id, key, name, params: { transaction_id: key, currency: "USD", value: 16, items: [{ item_id: "starter_monthly", item_name: "Starter monthly", quantity: 1, price: 16 }] }, context, occurredAt });
  const delivered: any[] = [];
  const flush = () => reports.flushAnalyticsReports(50, (async (_url: any, init: any) => { delivered.push(JSON.parse(init.body)); return new Response(null, { status: 204 }); }) as typeof fetch);
  await t.test("normalization vectors and domain-separated withdrawal receipt tampering/environment checks", () => {
    assert.equal(policy.hashConversionEmail(" F.ixture.Test@GMAIL.com "), createHash("sha256").update("fixturetest@gmail.com").digest("hex"));
    assert.equal(policy.hashConversionEmail(" a.b@example.com "), createHash("sha256").update("a.b@example.com").digest("hex"));
    assert.equal(policy.hashConversionEmail("bad"), null);
    const receipt = policy.adsWithdrawalReceipt(user.id, user.createdAt.toISOString(), "fixture-token");
    assert.ok(policy.readAdsWithdrawalReceipt(receipt)); assert.equal(policy.readAdsWithdrawalReceipt(receipt + "x"), null);
    process.env.VERCEL_ENV = "production"; assert.equal(policy.readAdsWithdrawalReceipt(receipt), null); process.env.VERCEL_ENV = "preview";
  });
  await t.test("default off; grants reject wrong origin, account, unverified email, absent analytics and GPC", async () => {
    assert.equal((await (await api.GET(request("GET", null))).json()).granted, false);
    for (const extra of [{ origin: "https://foreign.test" }, { [ACCOUNT_SCOPE_HEADER]: "another-account" }, { cookie: "" }, { "sec-gpc": "1" }])
      assert.equal((await api.POST(request("POST", { storage: true, userData: true }, extra))).status, 403);
    session.user.emailVerified = false; assert.equal((await api.POST(request("POST", { storage: true, userData: true }))).status, 403); session.user.emailVerified = true;
    process.env.NEXT_PUBLIC_GA_ENHANCED_CONVERSIONS_ENABLED = "false";
    assert.equal((await api.POST(request("POST", { storage: true, userData: true }))).status, 403);
    process.env.NEXT_PUBLIC_GA_ENHANCED_CONVERSIONS_ENABLED = "true";
  });
  await t.test("only consented purchases enhanced; late permission never enhances old events; duplicate invoice sends once", async () => {
    await queue("before"); const grantTime = Date.now(); await grant();
    await queue("late-event", new Date(grantTime - 1000)); await queue("after"); await queue("after"); await queue("signup", new Date(), "sign_up");
    assert.equal(facts.size, 4); assert.ok(!JSON.stringify([...facts.values()]).includes(user.email));
    await flush(); assert.equal(delivered.length, 4);
    const purchase = delivered.find(row => row.events[0].params.transaction_id === "after");
    assert.equal(purchase.user_data.sha256_email_address, policy.hashConversionEmail(user.email));
    assert.equal(purchase.consent.ad_user_data, "GRANTED"); assert.equal(purchase.consent.ad_personalization, "DENIED");
    assert.equal(purchase.events[0].params.value, 16); assert.equal(purchase.events[0].params.currency, "USD"); assert.equal(purchase.user_id, undefined);
    assert.ok(delivered.filter(row => row !== purchase).every(row => !row.user_data && row.consent.ad_user_data === "DENIED"));
  });
  await t.test("repeated allow is idempotent; withdrawal after logout revokes queued purchase; reallow cannot revive old evidence", async () => {
    const initial = await grant(), repeat = await grant(); assert.equal(initial.receipt, repeat.receipt);
    await queue("revoked"); session = null;
    assert.equal((await api.DELETE(request("DELETE", { receipt: initial.receipt }))).status, 200);
    session = { user: { id: user.id, email: user.email, accountCreatedAt: user.createdAt.toISOString(), emailVerified: true } };
    const replacement = await grant(); assert.notEqual(replacement.receipt, initial.receipt);
    await api.DELETE(request("DELETE", { receipt: initial.receipt })); assert.equal((await (await api.GET(request("GET", null))).json()).granted, true);
    await flush(); assert.equal(delivered.at(-1).user_data, undefined);
  });
  await t.test("email changes, recreated accounts and rollout kill switch fail closed while basic purchase still sends", async () => {
    for (const scenario of ["email", "epoch", "disabled"]) {
      await grant(); await queue(scenario);
      const oldEmail = user.email, oldEpoch = user.createdAt;
      if (scenario === "email") user.email = "different@example.test";
      if (scenario === "epoch") user.createdAt = new Date(oldEpoch.getTime() + 1);
      if (scenario === "disabled") process.env.NEXT_PUBLIC_GA_ENHANCED_CONVERSIONS_ENABLED = "false";
      await flush(); assert.equal(delivered.at(-1).user_data, undefined);
      user.email = oldEmail; user.createdAt = oldEpoch; process.env.NEXT_PUBLIC_GA_ENHANCED_CONVERSIONS_ENABLED = "true";
    }
  });
  await t.test("withdrawal supersedes an in-flight allow request before it can persist a late grant", async () => {
    const active = await grant(); let release!: (value: any) => void;
    sessionWait = new Promise(resolve => { release = resolve; });
    const delayed = api.POST(request("POST", { storage: true, userData: true }));
    await new Promise(resolve => setTimeout(resolve, 2));
    assert.equal((await api.DELETE(request("DELETE", { receipt: active.receipt }))).status, 200);
    sessionWait = null; release(session);
    assert.equal((await delayed).status, 409);
    assert.equal((await (await api.GET(request("GET", null))).json()).granted, false);
  });
  await t.test("US/TW defaults record their basis, require signed current-region evidence, honor withdrawal and never enhance foreign-context purchases", async () => {
    contexts.delete(policy.adsConsentKey(user.id));
    const regional = { ...context, collectionBasis: "regional_default" as const, collectionCountry: "US" };
    await reports.saveAnalyticsContext(db, user, regional);
    const extra = { "x-vercel-ip-country": "US", cookie: `flownana_analytics=${reports.signAnalyticsContext(regional)}` };
    const body = { storage: true, userData: true, basis: "regional_default" };
    assert.equal((await api.POST(request("POST", body, { ...extra, "x-vercel-ip-country": "JP" }))).status, 403);
    assert.equal((await api.POST(request("POST", body, { "x-vercel-ip-country": "US" }))).status, 403);
    const response = await api.POST(request("POST", body, extra));
    assert.equal(response.status, 200);
    const result = await response.json();
    const saved = contexts.get(policy.adsConsentKey(user.id)).context;
    assert.equal(saved.basis, "regional_default"); assert.equal(saved.country, "US"); assert.ok(saved.expiresAt > saved.grantedAt);
    assert.equal((await (await api.GET(request("GET", null, extra))).json()).granted, true);
    assert.equal((await (await api.GET(request("GET", null, { ...extra, "x-vercel-ip-country": "JP" }))).json()).granted, false);
    for (const [key, country] of [["regional-us", "US"], ["regional-foreign", "JP"]]) {
      await reports.queueAnalyticsReport(db, { userId: user.id, key, name: "purchase", params: { transaction_id: key, value: 16, currency: "USD" },
        context: { ...regional, collectionCountry: country }, occurredAt: new Date() });
    }
    await flush();
    assert.ok(delivered.find(row => row.events[0].params.transaction_id === "regional-us").user_data);
    assert.equal(delivered.find(row => row.events[0].params.transaction_id === "regional-foreign").user_data, undefined);
    await api.DELETE(request("DELETE", { receipt: result.receipt }, extra));
    await new Promise(resolve => setTimeout(resolve, 2));
    assert.equal((await api.POST(request("POST", body, extra))).status, 409);
    assert.equal((await (await api.GET(request("GET", null, extra))).json()).defaultAllowed, false);
    assert.equal((await api.POST(request("POST", { ...body, basis: "explicit" }, extra))).status, 200);
    assert.equal(contexts.get(policy.adsConsentKey(user.id)).context.basis, "explicit");
  });
});

test("anonymous regional defaults do not fabricate Allow, and explicit rejection survives refresh/account changes", async t => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window"), originalFetch = globalThis.fetch;
  const oldFlag = process.env.NEXT_PUBLIC_GA_ENHANCED_CONVERSIONS_ENABLED;
  process.env.NEXT_PUBLIC_GA_ENHANCED_CONVERSIONS_ENABLED = "true";
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "window", { configurable: true, value: { dispatchEvent() {}, gtag() {}, localStorage: {
    getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key),
  } } });
  globalThis.fetch = (async () => Response.json({ enabled: true, verified: true, granted: false, defaultAllowed: true })) as typeof fetch;
  t.after(() => { globalThis.fetch = originalFetch; oldFlag === undefined ? delete process.env.NEXT_PUBLIC_GA_ENHANCED_CONVERSIONS_ENABLED : process.env.NEXT_PUBLIC_GA_ENHANCED_CONVERSIONS_ENABLED = oldFlag;
    originalWindow ? Object.defineProperty(globalThis, "window", originalWindow) : Reflect.deleteProperty(globalThis, "window"); });
  const load = () => createSourceLoader({})<typeof import("../lib/advertising-consent")>("lib/advertising-consent.ts");
  const client = load(); await client.refreshAdvertisingConsent(); client.configureAdvertisingDefault(true);
  assert.equal(client.hasAdvertisingConsent(), true);
  assert.equal(storage.has("flownana_analytics_consent"), false);
  client.revokeAdvertising(); await client.reconcileAdvertisingWithdrawal();
  const again = load(); await again.refreshAdvertisingConsent(); again.configureAdvertisingDefault(true);
  assert.equal(again.hasAdvertisingConsent(), false);
  again.bindAdvertisingAccount("different-account");
  assert.equal(again.hasAdvertisingConsent(), false);
});

test("browser grants are account-bound and offline withdrawal survives reload and logout", async t => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window"), originalFetch = globalThis.fetch;
  const storage = new Map<string, string>(), calls: any[] = [];
  let online = true;
  Object.defineProperty(globalThis, "window", { configurable: true, value: { dispatchEvent() {}, gtag() {}, localStorage: {
    getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key),
  } } });
  globalThis.fetch = (async (_url: unknown, init: any) => { calls.push(init); if (!online) throw new Error("offline");
    return Response.json(init?.method === "POST" ? { granted: true, receipt: "signed-fixture" } : init?.method === "DELETE" ? { ok: true } : { enabled: true, verified: true, granted: false }); }) as typeof fetch;
  t.after(() => { globalThis.fetch = originalFetch; originalWindow ? Object.defineProperty(globalThis, "window", originalWindow) : Reflect.deleteProperty(globalThis, "window"); });
  const load = () => createSourceLoader({})<typeof import("../lib/advertising-consent")>("lib/advertising-consent.ts");
  const client = load(); client.bindAdvertisingAccount("account-a"); await client.refreshAdvertisingConsent();
  assert.equal(client.hasAdvertisingConsent(), false); assert.equal(await client.allowAdvertising(), true);
  client.bindAdvertisingAccount("account-b"); assert.equal(client.hasAdvertisingConsent(), false);
  online = false; client.revokeAdvertising(); await client.reconcileAdvertisingWithdrawal(); assert.equal(client.advertisingState().pending, true);
  const reloaded = load(); reloaded.bindAdvertisingAccount(null); assert.equal(reloaded.hasAdvertisingConsent(), false);
  online = true; await reloaded.reconcileAdvertisingWithdrawal();
  assert.equal(reloaded.advertisingState().pending, false); assert.equal(reloaded.hasAdvertisingConsent(), false);
  assert.ok(calls.some(call => call.method === "DELETE" && JSON.parse(call.body).receipt === "signed-fixture"));
  reloaded.bindAdvertisingAccount("account-c"); await reloaded.refreshAdvertisingConsent();
  online = false; assert.equal(await reloaded.allowAdvertising(), false);
  await reloaded.reconcileAdvertisingWithdrawal(); assert.equal(reloaded.advertisingState().pending, true);
  const afterTimeout = load(); afterTimeout.bindAdvertisingAccount("account-c");
  assert.equal(afterTimeout.hasAdvertisingConsent(), false);
  online = true; await afterTimeout.reconcileAdvertisingWithdrawal(); assert.equal(afterTimeout.advertisingState().pending, false);
});

test("anonymous explicit advertising choice survives reload, binds once, and never grants a second account", async t => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window"), originalFetch = globalThis.fetch;
  const oldFlag = process.env.NEXT_PUBLIC_GA_ENHANCED_CONVERSIONS_ENABLED;
  process.env.NEXT_PUBLIC_GA_ENHANCED_CONVERSIONS_ENABLED = "true";
  const storage = new Map<string, string>(); const posts: any[] = [];
  Object.defineProperty(globalThis, "window", { configurable: true, value: { dispatchEvent() {}, gtag() {}, localStorage: {
    getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key),
  } } });
  let verified = false, preexisting = false;
  globalThis.fetch = (async (_url: unknown, init: any) => {
    if (init?.method === "POST") { posts.push(init); return Response.json({ granted: true, receipt: "fixture-receipt" }); }
    return Response.json({ enabled: true, verified, granted: preexisting, ...(preexisting ? { receipt: "existing-receipt" } : {}), defaultAllowed: false });
  }) as typeof fetch;
  t.after(() => { globalThis.fetch = originalFetch; oldFlag === undefined ? delete process.env.NEXT_PUBLIC_GA_ENHANCED_CONVERSIONS_ENABLED : process.env.NEXT_PUBLIC_GA_ENHANCED_CONVERSIONS_ENABLED = oldFlag;
    originalWindow ? Object.defineProperty(globalThis, "window", originalWindow) : Reflect.deleteProperty(globalThis, "window"); });
  const load = () => createSourceLoader({})<typeof import("../lib/advertising-consent")>("lib/advertising-consent.ts");
  const oldBasic = load(); storage.set("flownana_analytics_consent", "granted"); await oldBasic.refreshAdvertisingConsent();
  assert.equal(oldBasic.hasAdvertisingConsent(), false, "old analytics choice is not new advertising consent");
  assert.equal(oldBasic.allowAnonymousAdvertising(), true); assert.equal(oldBasic.hasAdvertisingConsent(), true);
  const next = load(); await next.refreshAdvertisingConsent(); assert.equal(next.hasAdvertisingConsent(), true);
  const intent = JSON.parse(storage.get("flownana_advertising_intent")!);
  storage.set("flownana_advertising_intent", JSON.stringify({ ...intent, grantedAt: Date.now() - 181 * 86400_000 }));
  assert.equal(next.hasAdvertisingConsent(), false, "expired intent does not enable advertising");
  storage.set("flownana_advertising_intent", JSON.stringify(intent));
  next.bindAdvertisingAccount("account-a"); await next.ensureDefaultAdvertising(); assert.equal(posts.length, 0, "unverified email is not bound");
  verified = true; await Promise.all([next.ensureDefaultAdvertising(), next.ensureDefaultAdvertising()]);
  assert.equal(posts.length, 1); assert.equal(next.hasAdvertisingConsent(), true);
  assert.equal(JSON.parse(posts[0].body).basis, "explicit");
  const switched = load(); switched.bindAdvertisingAccount("account-b"); await switched.ensureDefaultAdvertising();
  assert.equal(posts.length, 1); assert.equal(switched.hasAdvertisingConsent(), false);
  switched.bindAdvertisingAccount(null); await switched.refreshAdvertisingConsent(); assert.equal(switched.hasAdvertisingConsent(), false);
  switched.revokeAdvertising(); await switched.reconcileAdvertisingWithdrawal();
  assert.equal(storage.has("flownana_advertising_intent"), false);
  const rejected = load(); rejected.bindAdvertisingAccount("account-c"); await rejected.ensureDefaultAdvertising(); assert.equal(posts.length, 1);
  rejected.bindAdvertisingAccount(null); await rejected.refreshAdvertisingConsent(); rejected.allowAnonymousAdvertising();
  preexisting = true; rejected.bindAdvertisingAccount("account-d"); await rejected.ensureDefaultAdvertising();
  assert.equal(JSON.parse(storage.get("flownana_advertising_intent")!).account, "account-d", "existing account grant still consumes the anonymous intent");
  preexisting = false; rejected.bindAdvertisingAccount("account-e"); await rejected.ensureDefaultAdvertising();
  assert.equal(posts.length, 1); assert.equal(rejected.hasAdvertisingConsent(), false);
});
