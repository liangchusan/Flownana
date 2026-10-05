import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { isolatedTestDatabase } from "./helpers/test-database.ts";
import { createSourceLoader } from "./helpers/load-source.ts";
import { PRODUCTION_GA_ID, TEST_GA_ID } from "../lib/analytics-policy.ts";
import { ACCOUNT_SCOPE_HEADER, getAccountScope } from "../lib/account-scope.ts";

const testUrl = process.env.FLOWNANA_TEST_DATABASE_URL;
test("verified analytics facts, concurrency and recovery on isolated PostgreSQL", { skip: !testUrl }, async t => {
  const db = isolatedTestDatabase(testUrl!);
  Object.assign(process.env, { NEXT_PUBLIC_GA_ENABLED: "true", NEXT_PUBLIC_GA_MEASUREMENT_ID: TEST_GA_ID,
    VERCEL_ENV: "preview", NEXTAUTH_SECRET: "analytics_local_fixture_only", GA_API_SECRET: "local_transport_fixture_only",
    STRIPE_PRICE_STARTER_MONTHLY: "price_local_ga_starter" });
  const fixtures: string[] = [];
  t.after(async () => { await db.user.deleteMany({ where: { id: { in: fixtures } } }); await db.$disconnect(); });
  const deferred: Array<() => Promise<void>> = [];
  const load = createSourceLoader({ "@/lib/prisma": { prisma: db }, "next/server": { after: (work: () => Promise<void>) => deferred.push(work) } });
  const reports = load<typeof import("../lib/analytics-server")>("lib/analytics-server.ts");
  const users = load<typeof import("../lib/user-sync")>("lib/user-sync.ts");
  const context = { clientId: "12345.98765", sessionId: 1791160000, capturedAt: Date.now(), measurementId: TEST_GA_ID };
  async function account() {
    const id = `ga_test_${randomUUID()}`; fixtures.push(id);
    return db.user.create({ data: { id, email: `${id}@example.test`, stripeCustomerId: `cus_${id}` } });
  }
  await t.test("signed consent context rejects tampering, wrong property and expired cookie", () => {
    const cookie = reports.signAnalyticsContext(context)!;
    assert.deepEqual(reports.readAnalyticsContext(cookie), context);
    assert.equal(reports.readAnalyticsContext(cookie + "invalid"), null);
    assert.equal(reports.readAnalyticsContext(reports.signAnalyticsContext({ ...context, capturedAt: Date.now() - 73 * 3600000 })), null);
    assert.equal(reports.readAnalyticsContext(reports.signAnalyticsContext({ ...context, measurementId: "G-2PTWF8DJE2" })), null);
  });
  await t.test("genuine registration creates exactly one fact; old login, recent account and concurrent retries do not add facts", async () => {
    const id = `ga_test_${randomUUID()}`; fixtures.push(id);
    const profile = { id, email: `${id}@example.test`, name: "Fixture", analyticsContext: context };
    await users.upsertAppUser(profile);
    await Promise.all(Array.from({ length: 5 }, () => users.upsertAppUser(profile)));
    const rows = await db.analyticsReport.findMany({ where: { userId: id } });
    assert.equal(rows.length, 1); assert.equal(rows[0].name, "sign_up");
    assert.deepEqual(rows[0].params, { method: "google" }); assert.equal(rows[0].status, "pending");
    const legacy = await account(); await users.upsertAppUser({ id: legacy.id, email: legacy.email, analyticsContext: context });
    assert.equal(await db.analyticsReport.count({ where: { userId: legacy.id } }), 0);
  });
  await t.test("missing consent is a coverage gap, not an invented client/session; context replay never backfills it", async () => {
    const id = `ga_test_${randomUUID()}`; fixtures.push(id);
    const user = await users.upsertAppUser({ id, email: `${id}@example.test` });
    const report = await db.analyticsReport.findFirstOrThrow({ where: { userId: id } });
    assert.equal(report.status, "missing_context"); assert.equal(report.context, null);
    await db.$transaction(tx => reports.saveAnalyticsContext(tx, user, context));
    assert.equal((await db.analyticsReport.findUniqueOrThrow({ where: { id: report.id } })).status, "missing_context");
  });
  await t.test("context API enforces origin/property/account and withdrawal revokes pending reports after logout", async () => {
    const user = await account();
    let session: any = { user: { id: user.id, accountCreatedAt: user.createdAt.toISOString() } };
    const jsonResponse = (body: unknown, init?: ResponseInit) => {
      const response = Response.json(body, init) as any;
      response.cookies = { set: (name: string, value: string) => response.headers.set("set-cookie", `${name}=${value}; HttpOnly; SameSite=Lax; Path=/`),
        delete: (name: string) => response.headers.set("set-cookie", `${name}=; Max-Age=0; Path=/`) };
      return response;
    };
    const api = createSourceLoader({ "@/lib/prisma": { prisma: db }, "@/lib/auth-options": { authOptions: {} },
      "next-auth": { getServerSession: async () => session }, "next/server": { NextResponse: { json: jsonResponse } },
    })<typeof import("../app/api/analytics/context/route")>("app/api/analytics/context/route.ts");
    const fresh = { ...context, clientId: "999.888", capturedAt: Date.now() };
    const post = (body: unknown, headers: Record<string, string> = {}) => api.POST(new Request("http://localhost/api/analytics/context", {
      method: "POST", headers: { origin: "http://localhost", "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
    }));
    assert.equal((await post(fresh, { origin: "https://other.test" })).status, 403);
    assert.equal((await post({ ...fresh, measurementId: "G-2PTWF8DJE2" })).status, 400);
    assert.equal((await post(fresh, { [ACCOUNT_SCOPE_HEADER]: "stale-account" })).status, 409);
    assert.equal((await post({ ...fresh, collectionBasis: "regional_default" }, { "x-vercel-ip-country": "DE" })).status, 403);
    assert.equal((await post(fresh, { "x-vercel-ip-country": "US", "sec-gpc": "1" })).status, 403);
    const regional = await post({ ...fresh, collectionBasis: "regional_default" }, { "x-vercel-ip-country": "US", [ACCOUNT_SCOPE_HEADER]: getAccountScope(session.user)! });
    assert.equal(regional.status, 200);
    const regionalCookie = regional.headers.get("set-cookie")!.split(";")[0];
    assert.equal(reports.contextFromRequest(new Request("http://localhost", { headers: { cookie: regionalCookie, "x-vercel-ip-country": "DE" } })), null);
    assert.equal(reports.contextFromRequest(new Request("http://localhost", { headers: { cookie: regionalCookie, "sec-gpc": "1" } })), null);
    assert.ok(reports.contextFromRequest(new Request("http://localhost", { headers: { cookie: regionalCookie, "sec-gpc": "1" } }), true));
    const response = await post(fresh, { [ACCOUNT_SCOPE_HEADER]: getAccountScope(session.user)! });
    assert.equal(response.status, 200); assert.match(response.headers.get("set-cookie")!, /HttpOnly/);
    const cookie = response.headers.get("set-cookie")!.split(";")[0];
    const savedContext = reports.contextFromRequest(new Request("http://localhost", { headers: { cookie } }))!;
    assert.equal(savedContext.clientId, fresh.clientId); assert.ok(savedContext.capturedAt >= fresh.capturedAt);
    await db.$transaction(async tx => {
      assert.deepEqual(await reports.getAccountAnalyticsContext(tx, user.id), savedContext);
      await reports.saveAnalyticsContext(tx, user, fresh, "checkout:cs_withdrawal");
      await reports.queueAnalyticsReport(tx, { userId: user.id, key: `withdrawal:${user.id}`, name: "purchase", params: {}, context: fresh });
    });
    session = null;
    const withdrawn = await api.DELETE(new Request("http://localhost/api/analytics/context", { method: "DELETE", headers: { origin: "http://localhost", cookie } }));
    assert.equal(withdrawn.status, 200); assert.match(withdrawn.headers.get("set-cookie")!, /Max-Age=0/);
    assert.equal(await db.analyticsContext.count({ where: { userId: user.id } }), 0);
    const row = await db.analyticsReport.findFirstOrThrow({ where: { userId: user.id } });
    assert.equal(row.status, "revoked"); assert.equal(row.context, null);
    assert.equal((await api.DELETE(new Request("http://localhost/api/analytics/context", { method: "DELETE", headers: { origin: "https://other.test" } }))).status, 403);
  });
  await t.test("concurrent report insertion deduplicates across browsers/processes and environment is preserved", async () => {
    const user = await account();
    await Promise.all(Array.from({ length: 8 }, () => db.$transaction(tx => reports.queueAnalyticsReport(tx, {
      userId: user.id, key: user.id, name: "generation_completed", params: { media_type: "image" }, context,
    }))));
    const rows = await db.analyticsReport.findMany({ where: { userId: user.id } });
    assert.equal(rows.length, 1); assert.equal(rows[0].environment, "test");
  });
  await t.test("generation completion reports only after durable success; replay, failures and multiple outputs remain correct", async () => {
    const user = await account();
    const lifecycle = createSourceLoader({ "@/lib/prisma": { prisma: db }, "@/lib/media-assets": { syncGenerationMediaAssets: async () => {} } })<typeof import("../lib/generation-lifecycle")>("lib/generation-lifecycle.ts");
    for (const type of ["image", "image", "video"]) {
      const generation = await db.generation.create({ data: { userId: user.id, type, status: "generating", prompt: "PRIVATE_PROMPT_DO_NOT_SEND" } });
      await db.$transaction(tx => reports.saveAnalyticsContext(tx, user, context, `generation:${generation.id}`));
      const args = { account: { id: user.id, accountCreatedAt: user.createdAt.toISOString() }, id: generation.id,
        output: { type, role: "output", media: { url: "https://fixture.example.test/persisted-output" } } } as any;
      const first = await lifecycle.completeGeneration(args); const second = await lifecycle.completeGeneration(args);
      assert.equal(first.accepted, true); assert.equal(second.accepted, false);
      assert.equal((await db.generation.findUniqueOrThrow({ where: { id: generation.id } })).status, "success");
    }
    const failed = await db.generation.create({ data: { userId: user.id, type: "image", status: "failed", prompt: "PRIVATE" } });
    assert.equal((await lifecycle.completeGeneration({ account: { id: user.id }, id: failed.id, output: { type: "image", role: "output", media: { url: "https://fixture.example.test/result" } } } as any)).accepted, false);
    const rows = await db.analyticsReport.findMany({ where: { userId: user.id } });
    assert.equal(rows.length, 3); assert.equal(new Set(rows.map(r => r.userId)).size, 1);
    assert.doesNotMatch(JSON.stringify(rows.map(r => r.params)), /PRIVATE|prompt|https/);
  });
  await t.test("ordinary image/video, template batches and Agent share durable completion and immutable creation context", async () => {
    const user = await account(); const scoped = { id: user.id, accountCreatedAt: user.createdAt.toISOString() };
    await db.creditBatch.create({ data: { userId: user.id, amount: 1000, remaining: 1000, source: "ga_fixture", expiresAt: new Date(Date.now() + 86400000) } });
    const source = createSourceLoader({ "@/lib/prisma": { prisma: db }, "./understand": { understandTemplate: async () => ({ status: "ready", spec: {
      summary: "Symbol", subject: "Symbol", composition: "Centered", style: "Minimal", preserve: [], text: [], constraints: [],
      variants: ["A", "B", "C", "D"].map(title => ({ title, direction: `${title} concept` })), outputCount: 4,
    } }) } });
    const lifecycle = source<typeof import("../lib/generation-lifecycle")>("lib/generation-lifecycle.ts");
    let successes = 0;
    async function settle(outputs: any[]) {
      // A later browsing session must not change attribution for already accepted jobs.
      await db.$transaction(tx => reports.saveAnalyticsContext(tx, user, { ...context, clientId: "444.555" }));
      for (const g of outputs) {
        assert.equal((await db.$transaction(tx => reports.getAccountAnalyticsContext(tx, user.id, `generation:${g.id}`)))?.clientId, context.clientId);
        const args = { account: scoped, id: g.id, output: { type: g.type, role: "output", media: { url: `https://fixture.example.test/${g.id}.${g.type === "image" ? "png" : "mp4"}`, sizeBytes: 1024 } } } as any;
        assert.equal((await lifecycle.completeGeneration(args)).accepted, true);
        assert.equal((await lifecycle.completeGeneration(args)).accepted, false);
        assert.equal(await db.generationMedia.count({ where: { generationId: g.id, role: "output" } }), 1);
        successes++;
      }
      assert.equal(await db.analyticsReport.count({ where: { userId: user.id, name: "generation_completed", status: "pending" } }), successes);
    }
    for (const type of ["image", "video"] as const) {
      await db.$transaction(tx => reports.saveAnalyticsContext(tx, user, context));
      await settle([await lifecycle.reserveGeneration({ account: scoped, type, prompt: "PRIVATE", modelOptionId: "fixture", creditsCost: 2, parameters: {}, inputs: [] })]);
    }
    await db.$transaction(tx => reports.saveAnalyticsContext(tx, user, context));
    const templates = source<typeof import("../lib/image-templates/service")>("lib/image-templates/service.ts");
    const runId = randomUUID();
    const run = await templates.analyzeTemplateRun(scoped, runId, 0, { templateId: "logo", prompt: "Create a symbol", images: [], answers: {} });
    const unit = source<typeof import("../lib/generation-pricing")>("lib/generation-pricing.ts").getImageGenerationCredits("gpt-image-2-5-sunburst", "1K", 0)!;
    const batch = await templates.generateTemplateRun(scoped, runId, run.revision, { count: 4, resolution: "1K", aspectRatio: "1:1", quotedCredits: unit * 4 });
    await settle(batch.outputs);
    await db.$transaction(tx => reports.saveAnalyticsContext(tx, user, context));
    const agent = source<typeof import("../lib/agent/service")>("lib/agent/service.ts");
    const started = await agent.beginAgentTurn(scoped, { id: randomUUID(), conversationId: randomUUID(), revision: 0, prompt: "Create a symbol", inputs: [] });
    const quote = source<typeof import("../lib/agent/contract")>("lib/agent/contract.ts").buildQuote({ type: "image", summary: "Two symbols", prompt: "Create symbols", exactText: [], count: 2, directions: [] } as any, [], { userText: "Create symbols" });
    await agent.finishAgentTurn(scoped, started.turn, { response: "Review", suggestions: [], quote });
    const generated = await agent.confirmAgentQuote(scoped, started.turn.conversationId, started.turn.id);
    await settle(generated.outputs);
    assert.equal(successes, 8);
  });
  await t.test("remote invoice reread, paid cash, discount/tax and webhook/return share one Invoice ID", async () => {
    const user = await account();
    const sub = { id: `sub_${user.id}`, customer: user.stripeCustomerId, livemode: false, created: Math.floor(Date.now()/1000), metadata: { userId: user.id, accountCreatedAt: user.createdAt.toISOString() } };
    const invoice = { id: `in_${user.id}`, subscription: sub.id, customer: user.stripeCustomerId, paid: true, status: "paid", livemode: false,
      payment_intent: `pi_${user.id}`, amount_paid: 1400, total: 1400, total_excluding_tax: 1200, currency: "usd", billing_reason: "subscription_cycle",
      created: Math.floor(Date.now()/1000), status_transitions: { paid_at: Math.floor(Date.now()/1000) },
      lines: { has_more: false, data: [{ amount: 1600, quantity: 1, price: { id: "price_local_ga_starter" } }] } };
    const intent = { id: invoice.payment_intent, customer: user.stripeCustomerId, status: "succeeded", amount_received: 1400, currency: "usd", livemode: false };
    let remoteReads = 0;
    const stripe = { invoices: { retrieve: async () => { remoteReads++; return invoice; } }, subscriptions: { retrieve: async () => sub }, paymentIntents: { retrieve: async () => intent } };
    const purchase = createSourceLoader({ "@/lib/prisma": { prisma: db }, "@/lib/stripe": { getStripe: () => stripe } })<typeof import("../lib/analytics-purchase")>("lib/analytics-purchase.ts");
    await db.$transaction(tx => reports.saveAnalyticsContext(tx, user, context));
    await Promise.all([purchase.reportVerifiedInvoice(invoice.id, user.id), purchase.reportVerifiedInvoice(invoice.id, user.id)]);
    assert.equal(remoteReads, 2);
    const rows = await db.analyticsReport.findMany({ where: { userId: user.id } });
    assert.equal(rows.length, 1);
    const params = rows[0].params as any;
    assert.equal(params.transaction_id, invoice.id); assert.equal(params.value, 12); assert.equal(params.tax, 2); assert.equal(params.purchase_type, "renewal");
    // Initial/upgrade payment uses the immutable Checkout context, not a later session.
    const reservationId = `checkout_${user.id}`, checkoutId = `cs_${user.id}`;
    await db.checkoutReservation.create({ data: { id: reservationId, userId: user.id, accountCreatedAt: user.createdAt,
      kind: "purchase", priceKey: "starter_monthly", stripePriceId: "price_local_ga_starter", stripeSessionId: checkoutId,
      sessionParams: {}, expiresAt: new Date(Date.now() + 3600000) } });
    const checkoutContext = { ...context, clientId: "222.333" };
    await db.$transaction(async tx => {
      await reports.saveAnalyticsContext(tx, user, checkoutContext, `checkout:${checkoutId}`);
      await reports.saveAnalyticsContext(tx, user, { ...context, clientId: "777.888" }, `checkout:${checkoutId}`);
    });
    Object.assign(sub.metadata, { checkoutReservationId: reservationId });
    Object.assign(invoice, { id: `in_initial_${user.id}`, billing_reason: "subscription_create" });
    await purchase.reportVerifiedInvoice(invoice.id, user.id);
    const initial = await db.analyticsReport.findFirstOrThrow({ where: { userId: user.id, id: { endsWith: invoice.id } } });
    assert.equal((initial.params as any).purchase_type, "new_subscription"); assert.equal((initial.context as any).clientId, "222.333");
    Object.assign(sub.metadata, { upgradeFromSubscriptionId: "sub_previous" });
    invoice.id = `in_upgrade_${user.id}`; await purchase.reportVerifiedInvoice(invoice.id, user.id);
    assert.equal(((await db.analyticsReport.findFirstOrThrow({ where: { userId: user.id, id: { endsWith: invoice.id } } })).params as any).purchase_type, "upgrade");
    for (const changes of [{ paid: false }, { status: "open" }, { amount_paid: 0 }, { paid_out_of_band: true }, { total_excluding_tax: null }])
      assert.equal(purchase.verifiedInvoiceEvent({ ...invoice, ...changes } as any, intent as any, "starter_monthly", "new_subscription"), null);
    assert.equal(purchase.verifiedInvoiceEvent(invoice as any, { ...intent, status: "processing" } as any, "starter_monthly", "upgrade"), null);
    assert.equal(purchase.verifiedInvoiceEvent(invoice as any, { ...intent, customer: "cus_someone_else" } as any, "starter_monthly", "upgrade"), null);
    await assert.rejects(purchase.reportVerifiedInvoice(invoice.id, "another_account"), /account mismatch/);
    invoice.livemode = true;
    await assert.rejects(purchase.reportVerifiedInvoice(invoice.id, user.id), /environment mismatch/);
  });
  await t.test("signed paid-invoice webhook queues purchase without a return page; retries share the durable transaction", async () => {
    const user = await account();
    const eventId = `evt_ga_${user.id}`;
    try {
      Object.assign(process.env, { VERCEL_ENV: "production", NEXT_PUBLIC_GA_MEASUREMENT_ID: PRODUCTION_GA_ID, STRIPE_WEBHOOK_SECRET: "fixture_signature_secret" });
      await db.$transaction(tx => reports.saveAnalyticsContext(tx, user, { ...context, measurementId: PRODUCTION_GA_ID }));
      const sub = { id: `sub_webhook_${user.id}`, customer: user.stripeCustomerId, livemode: true, created: Math.floor(Date.now()/1000),
        metadata: { userId: user.id, accountCreatedAt: user.createdAt.toISOString() }, items: { data: [{ price: { id: "price_local_ga_starter" } }] } };
      const invoice = { id: `in_webhook_${user.id}`, subscription: sub.id, customer: user.stripeCustomerId, paid: true, status: "paid", livemode: true,
        payment_intent: `pi_webhook_${user.id}`, amount_paid: 1600, total: 1600, total_excluding_tax: 1600, currency: "usd", billing_reason: "subscription_cycle",
        created: Math.floor(Date.now()/1000), status_transitions: { paid_at: Math.floor(Date.now()/1000) },
        lines: { has_more: false, data: [{ amount: 1600, quantity: 1, price: { id: "price_local_ga_starter" } }] } };
      let unavailable = true, grants = 0;
      const stripe = { webhooks: { constructEvent: (raw: string, signature: string) => { if (signature !== "valid_fixture_signature") throw new Error("Invalid fixture signature"); return JSON.parse(raw); } },
        subscriptions: { retrieve: async () => sub }, invoices: { retrieve: async () => { if (unavailable) throw new Error("fixture provider outage"); return invoice; } },
        paymentIntents: { retrieve: async () => ({ id: invoice.payment_intent, customer: invoice.customer, currency: "usd", status: "succeeded", amount_received: 1600, livemode: true }) } };
      const source = createSourceLoader({ "@/lib/prisma": { prisma: db }, "@/lib/stripe": { getStripe: () => stripe },
        "@/lib/subscription-credit-grant": { grantCreditsForCurrentPeriodIfNeeded: async () => { grants++; } },
        "next/server": { NextResponse: { json: Response.json } } });
      const webhook = source<typeof import("../app/api/webhooks/stripe/route")>("app/api/webhooks/stripe/route.ts");
      const body = JSON.stringify({ id: eventId, type: "invoice.paid", livemode: true, data: { object: invoice } });
      const request = (signature = "valid_fixture_signature") => new Request("https://www.flownana.com/api/webhooks/stripe", { method: "POST", headers: { "stripe-signature": signature }, body });
      assert.equal((await webhook.POST(request("invalid"))).status, 400);
      assert.equal(await db.analyticsReport.count({ where: { userId: user.id } }), 0);
      assert.equal((await webhook.POST(request())).status, 500);
      assert.equal(await db.processedStripeEvent.count({ where: { id: eventId } }), 0);
      unavailable = false; assert.equal((await webhook.POST(request())).status, 200);
      assert.equal((await webhook.POST(request())).status, 200);
      await source<typeof import("../lib/analytics-purchase")>("lib/analytics-purchase.ts").reportVerifiedInvoice(invoice.id, user.id);
      const rows = await db.analyticsReport.findMany({ where: { userId: user.id } });
      assert.equal(rows.length, 1); assert.equal((rows[0].params as any).transaction_id, invoice.id);
      assert.equal(rows[0].environment, "production"); assert.equal(grants, 2);
    } finally {
      await db.processedStripeEvent.deleteMany({ where: { id: eventId } });
      process.env.VERCEL_ENV = "preview"; process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = TEST_GA_ID;
    }
  });
  await t.test("network dispatch is deferred until after the business transaction commits", async subtest => {
    await db.analyticsReport.updateMany({ where: { userId: { in: fixtures } }, data: { status: "test_fixture_closed" } });
    deferred.length = 0; const user = await account(); let requests = 0;
    subtest.mock.method(globalThis, "fetch", async () => { requests++; return new Response(null, { status: 204 }); });
    await db.$transaction(tx => reports.queueAnalyticsReport(tx, { userId: user.id, key: `after:${user.id}`, name: "sign_up", params: { method: "google" }, context }));
    assert.equal(requests, 0); assert.equal(deferred.length, 1);
    assert.equal((await db.analyticsReport.findFirstOrThrow({ where: { userId: user.id } })).status, "pending");
    await deferred[0](); assert.equal(requests, 1);
    assert.equal((await db.analyticsReport.findFirstOrThrow({ where: { userId: user.id } })).status, "transmitted");
  });
  await t.test("concurrent dispatch is once; non-2xx retry, uncertain acceptance and stale events are distinguished", async () => {
    // Settle previous fixtures before isolating worker assertions.
    await db.analyticsReport.updateMany({ where: { userId: { in: fixtures } }, data: { status: "test_fixture_closed" } });
    const user = await account();
    async function add(key: string, age = 0) {
      await db.$transaction(tx => reports.queueAnalyticsReport(tx, { userId: user.id, key, name: "generation_completed", params: { media_type: "video" }, context, occurredAt: new Date(Date.now() - age) }));
    }
    await add(`${user.id}:once`); const payloads: any[] = [];
    const transport = (async (url: any, options: any) => { assert.match(url, /measurement_id=G-RP4MTRCXT0/); payloads.push(JSON.parse(options.body)); await new Promise(resolve => setTimeout(resolve, 10)); return new Response(null, { status: 204 }); }) as typeof fetch;
    await Promise.all([reports.flushAnalyticsReports(20, transport), reports.flushAnalyticsReports(20, transport)]);
    assert.equal(payloads.length, 1); assert.equal(payloads[0].client_id, context.clientId);
    assert.equal(payloads[0].events[0].params.session_id, context.sessionId); assert.equal(payloads[0].events[0].params.debug_mode, true);
    await add(`${user.id}:retry`); await reports.flushAnalyticsReports(20, (async () => new Response(null, { status: 429 })) as typeof fetch);
    const retry = await db.analyticsReport.findFirstOrThrow({ where: { userId: user.id, status: "retry" } });
    await db.analyticsReport.update({ where: { id: retry.id }, data: { nextAttemptAt: new Date(0) } }); await reports.flushAnalyticsReports(20, transport);
    assert.equal((await db.analyticsReport.findUniqueOrThrow({ where: { id: retry.id } })).status, "transmitted");
    await add(`${user.id}:uncertain`); await reports.flushAnalyticsReports(20, (async () => { throw new Error("fixture timeout"); }) as typeof fetch);
    assert.equal(await db.analyticsReport.count({ where: { userId: user.id, status: "uncertain" } }), 1);
    const count = payloads.length; await reports.flushAnalyticsReports(20, transport); assert.equal(payloads.length, count);
    await add(`${user.id}:stale`, 73 * 3600000); await reports.flushAnalyticsReports(20, transport);
    assert.equal(await db.analyticsReport.count({ where: { userId: user.id, status: "expired" } }), 1);
    await add(`${user.id}:interrupted`);
    await db.analyticsReport.updateMany({ where: { userId: user.id, status: "pending" }, data: { status: "sending", leaseUntil: new Date(0) } });
    await reports.flushAnalyticsReports(20, transport);
    assert.equal(await db.analyticsReport.count({ where: { userId: user.id, errorCode: "worker_interrupted" } }), 1);
    assert.equal(payloads.length, count);
  });
  await t.test("analytics tables have RLS, deny Data API roles and grant only the application role", async () => {
    for (const table of ["AnalyticsContext", "AnalyticsReport"]) {
      const rows = await db.$queryRaw<Array<{ enabled: boolean }>>`SELECT relrowsecurity AS enabled FROM pg_class WHERE oid = ${`public."${table}"`}::regclass`;
      assert.equal(rows[0].enabled, true);
      for (const role of ["anon", "authenticated", "service_role", "flownana_app"]) {
        for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
          const access = await db.$queryRaw<Array<{ allowed: boolean }>>`SELECT has_table_privilege(${role}, ${`public."${table}"`}, ${privilege}) AS allowed`;
          assert.equal(access[0].allowed, role === "flownana_app");
        }
      }
    }
  });
});
