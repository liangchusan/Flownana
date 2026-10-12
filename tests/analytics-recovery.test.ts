import assert from "node:assert/strict";
import test from "node:test";
import { analyticsRetryDelay, authorizedAnalyticsOperator } from "../lib/analytics-recovery-policy.ts";
import { createSourceLoader } from "./helpers/load-source.ts";

test("retry timing respects Retry-After without tight loops; operator endpoints fail closed", t => {
  const old = process.env.CRON_SECRET;
  t.after(() => { old === undefined ? delete process.env.CRON_SECRET : process.env.CRON_SECRET = old; });
  assert.equal(analyticsRetryDelay(1, null, 0, 0), 60_000);
  assert.equal(analyticsRetryDelay(2, "900", 0, 0), 900_000);
  assert.equal(analyticsRetryDelay(1, new Date(600_000).toUTCString(), 0, 0), 600_000);
  assert.equal(analyticsRetryDelay(100, "invalid", 0, 0), 3_600_000);
  assert.equal(analyticsRetryDelay(1, "999999999999", 0, 0), 86_400_000);
  delete process.env.CRON_SECRET;
  assert.equal(authorizedAnalyticsOperator(new Request("https://fixture.test")), false);
  process.env.CRON_SECRET = "fixture_operator";
  assert.equal(authorizedAnalyticsOperator(new Request("https://fixture.test", { headers: { authorization: "Bearer fixture_operator" } })), true);
  assert.equal(authorizedAnalyticsOperator(new Request("https://fixture.test", { headers: { authorization: "Bearer wrong" } })), false);
});

test("recovery drains more than one batch, respects budget and quarantines uncertain events", async t => {
  const envKeys = ["NEXT_PUBLIC_GA_ENABLED", "NEXT_PUBLIC_GA_MEASUREMENT_ID", "GA_API_SECRET", "VERCEL_ENV"];
  const old = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  Object.assign(process.env, { NEXT_PUBLIC_GA_ENABLED: "true", NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-RP4MTRCXT0", GA_API_SECRET: "fixture_only", VERCEL_ENV: "preview" });
  t.after(() => { for (const key of envKeys) old[key] === undefined ? delete process.env[key] : process.env[key] = old[key]; });
  const context = { clientId: "1.2", sessionId: Math.floor(Date.now() / 1000), capturedAt: Date.now(), measurementId: "G-RP4MTRCXT0" };
  const rows = Array.from({ length: 63 }, (_, i) => ({ id: `fixture_${i}`, userId: "fixture", name: "generation_completed", context, occurredAt: new Date(), status: "pending", nextAttemptAt: new Date(0), leaseUntil: null, params: {}, attempts: 0 }));
  let notifications = 0;
  const due = (r: typeof rows[number]) => ["pending", "retry"].includes(r.status) && r.nextAttemptAt <= new Date();
  const db = { analyticsReport: {
    findMany: async (args: any) => rows.filter(due).slice(0, args.take),
    count: async () => rows.filter(due).length,
    updateMany: async (args: any) => {
      const row = rows.find(r => r.id === args.where.id);
      if (!row) return { count: 0 };
      if (args.where.status === "sending" ? row.status !== "sending" : !due(row)) return { count: 0 };
      const data = { ...args.data };
      if (data.attempts) { row.attempts++; delete data.attempts; }
      Object.assign(row, data); return { count: 1 };
    },
  } };
  const reports = createSourceLoader({ "@/lib/prisma": { prisma: db }, "next/server": { after() {} } })<typeof import("../lib/analytics-server")>("lib/analytics-server.ts");
  const transport = (async () => { notifications++; return new Response(null, { status: notifications === 1 ? 500 : 204 }); }) as typeof fetch;
  assert.equal((await reports.recoverAnalyticsReports(35_000, transport)).transmitted, 62);
  assert.equal(rows.filter(r => r.status === "uncertain").length, 1);
  await reports.recoverAnalyticsReports(35_000, transport);
  assert.equal(notifications, 63);
  rows[1].status = "pending";
  await reports.recoverAnalyticsReports(0, transport);
  assert.equal(notifications, 63);
});

test("email incidents persist retries, suppress concurrent workers/cooldowns, recover once and remain disabled in Preview", async t => {
  const keys = ["VERCEL_ENV", "ANALYTICS_ALERT_RESEND_KEY", "ANALYTICS_ALERT_FROM", "ANALYTICS_ALERT_TO"];
  const old = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  t.after(() => { for (const key of keys) old[key] === undefined ? delete process.env[key] : process.env[key] = old[key]; });
  Object.assign(process.env, { VERCEL_ENV: "production", ANALYTICS_ALERT_RESEND_KEY: "fixture_only", ANALYTICS_ALERT_FROM: "alerts@example.test", ANALYTICS_ALERT_TO: "operator@example.test" });
  const state: any = { id: "production:analytics", notifiedSignature: null, notificationKey: null, notificationLease: null, nextNotificationAt: null };
  const db = { analyticsMonitorState: {
    upsert: async () => ({ ...state }),
    updateMany: async ({ where, data }: any) => {
      if (where.notificationKey !== state.notificationKey || (where.notifiedSignature !== undefined && where.notifiedSignature !== state.notifiedSignature)) return { count: 0 };
      if (where.AND && state.notificationLease && state.notificationLease > new Date()) return { count: 0 };
      Object.assign(state, data);
      if (typeof state.notificationPayload === "object" && state.notificationPayload === null) state.notificationPayload = null;
      return { count: 1 };
    },
  } };
  const monitor = createSourceLoader({ "@/lib/prisma": { prisma: db }, "@prisma/client": { Prisma: { DbNull: null } },
    "./analytics-server": { analyticsEnvironment: () => "production" }, "./analytics-billing-audit": {} })<typeof import("../lib/analytics-monitor")>("lib/analytics-monitor.ts");
  const health: any = { enabled: true, environment: "production", issues: ["uncertain"], counts: { uncertain: 1 }, lastSuccessfulRunAt: new Date().toISOString() };
  const messages: any[] = [];
  const transport = (async (_url: any, init: any) => { messages.push({ key: init.headers["Idempotency-Key"], body: init.body }); return new Response(null, { status: messages.length === 1 ? 503 : 200 }); }) as typeof fetch;
  assert.equal((await monitor.notifyAnalyticsHealth(health, transport)).status, "delivery_failed");
  state.nextNotificationAt = new Date(0);
  health.counts.uncertain = 2;
  assert.equal((await monitor.notifyAnalyticsHealth(health, transport)).status, "sent");
  assert.equal(messages[0].key, messages[1].key);
  assert.equal(messages[0].body, messages[1].body);
  assert.equal((await monitor.notifyAnalyticsHealth(health, transport)).status, "cooldown");
  state.nextNotificationAt = new Date(0);
  const concurrent = await Promise.all([monitor.notifyAnalyticsHealth(health, transport), monitor.notifyAnalyticsHealth(health, transport)]);
  assert.equal(concurrent.filter(r => r.status === "sent").length, 1);
  state.nextNotificationAt = new Date(0);
  health.issues = [];
  assert.equal((await monitor.notifyAnalyticsHealth(health, transport)).status, "sent");
  assert.equal((await monitor.notifyAnalyticsHealth(health, transport)).status, "healthy");
  assert.doesNotMatch(messages.at(-1).body, /fixture_only|userId|clientId|sessionId|sha256/);
  process.env.VERCEL_ENV = "preview";
  assert.equal((await monitor.notifyAnalyticsHealth(health, transport)).status, "not_configured");
});

test("payment audit paginates and distinguishes unqualified, missing and incomplete verification without replay", async () => {
  let page = 0;
  const events = { list: async () => { page++; return { data: [{ id: `evt_${page}`, livemode: false, data: { object: { id: `in_${page}` } } }], has_more: page === 1 }; } };
  const subject = createSourceLoader({ "@/lib/stripe": { getStripe: () => ({ events }) },
    "./analytics-server": { analyticsEnvironment: () => "test" },
    "./analytics-purchase": { verifiedInvoiceDetails: async (id: string) => ({ occurredAt: new Date(0), params: { transaction_id: id } }) },
    "@/lib/prisma": { prisma: { analyticsReport: { findUnique: async ({ where }: any) => where.id.endsWith("in_1") ? { id: where.id } : null } } },
  })<typeof import("../lib/analytics-billing-audit")>("lib/analytics-billing-audit.ts");
  const prior = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "preview";
  try {
    const result = await subject.auditAnalyticsPayments();
    assert.equal(result.complete, true); assert.equal(result.verified, 2); assert.equal(result.missing, 1);
    assert.equal((await subject.auditAnalyticsPayments(0)).complete, false);
  } finally { prior === undefined ? delete process.env.VERCEL_ENV : process.env.VERCEL_ENV = prior; }
});

test("invoice verification remains read-only and the original purchase queue retains invoice/type/value after refactoring", async t => {
  const prior = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "preview";
  t.after(() => { prior === undefined ? delete process.env.VERCEL_ENV : process.env.VERCEL_ENV = prior; });
  const user = { id: "fixture_user", stripeCustomerId: "cus_fixture", createdAt: new Date(0) };
  const sub = { id: "sub_fixture", customer: "cus_fixture", livemode: false, created: 1, metadata: { userId: user.id, accountCreatedAt: user.createdAt.toISOString() } };
  const invoice = { id: "in_fixture", subscription: sub.id, customer: sub.customer, paid: true, status: "paid", livemode: false,
    payment_intent: "pi_fixture", amount_paid: 1600, total: 1600, total_excluding_tax: 1600, currency: "usd", billing_reason: "subscription_create",
    created: 10, status_transitions: { paid_at: 10 }, lines: { has_more: false, data: [{ amount: 1600, quantity: 1, price: { id: "price_fixture" } }] } };
  const intent = { id: "pi_fixture", customer: sub.customer, status: "succeeded", amount_received: 1600, currency: "usd", livemode: false };
  const queued: any[] = [];
  const tx = { $queryRaw: async () => [{ id: user.id }], user: { findUnique: async () => user } };
  const subject = createSourceLoader({ "@/lib/prisma": { prisma: { user: tx.user, $transaction: async (fn: any) => fn(tx) } },
    "@/lib/stripe": { getStripe: () => ({ invoices: { retrieve: async () => invoice }, subscriptions: { retrieve: async () => sub }, paymentIntents: { retrieve: async () => intent } }) },
    "@/lib/plans": { getPriceKeyFromStripePriceId: () => ({ key: "starter_monthly" }) },
    "@/lib/analytics-server": { serverMeasurementId: () => "G-RP4MTRCXT0", getAccountAnalyticsContext: async () => null, queueAnalyticsReport: async (_tx: any, event: any) => { queued.push(event); } },
  })<typeof import("../lib/analytics-purchase")>("lib/analytics-purchase.ts");
  assert.equal((await subject.verifiedInvoiceDetails(invoice.id))?.params.value, 16);
  assert.equal(queued.length, 0);
  await subject.reportVerifiedInvoice(invoice.id);
  assert.equal(queued.length, 1);
  assert.equal(queued[0].params.transaction_id, invoice.id);
  assert.equal(queued[0].params.purchase_type, "new_subscription");
  assert.equal(queued[0].key, invoice.id);
  invoice.billing_reason = "subscription_cycle";
  assert.equal((await subject.verifiedInvoiceDetails(invoice.id))?.params.purchase_type, "renewal");
  intent.amount_received = 0;
  assert.equal(await subject.verifiedInvoiceDetails(invoice.id), undefined);
});
