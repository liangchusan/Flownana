import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import type Stripe from "stripe";
import { createSourceLoader } from "./helpers/load-source.ts";

const databaseUrl = process.env.FLOWNANA_TEST_DATABASE_URL;

// Never fall through to .env or a remote database, even when explicitly set.
function isolatedDatabase(url: string) {
  const parsed = new URL(url);
  assert.equal(parsed.protocol, "postgresql:");
  assert.equal(parsed.hostname, "localhost");
  assert.match(parsed.pathname, /^\/flownana_[a-z_]*test$/);
  assert.match(parsed.searchParams.get("host") ?? "", /^\/private\/tmp\/fnpg\.[A-Za-z0-9]+$/);
  return new PrismaClient({ datasources: { db: { url } } });
}

type GrantModule = typeof import("../lib/subscription-credit-grant");
type SyncModule = typeof import("../lib/subscription-sync");
type FinalizeModule = typeof import("../lib/stripe-checkout-finalization");
type WebhookModule = typeof import("../app/api/webhooks/stripe/route");

test("billing enforcement with real isolated PostgreSQL transactions", { skip: !databaseUrl }, async (t) => {
  const db = isolatedDatabase(databaseUrl!);
  t.after(() => db.$disconnect());
  process.env.STRIPE_PRICE_STARTER_MONTHLY = "price_test_starter_monthly";
  process.env.STRIPE_PRICE_STARTER_YEARLY = "price_test_starter_yearly";
  process.env.STRIPE_PRICE_PRO_YEARLY = "price_test_pro_yearly";
  process.env.STRIPE_PRICE_PRO_MONTHLY = "price_test_pro_monthly";
  process.env.STRIPE_PRICE_MAX_MONTHLY = "price_test_max_monthly";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_isolated_fixture";

  async function fixture(yearly = false) {
    const prefix = `billing_test_${randomUUID()}`;
    const user = await db.user.create({ data: {
      id: prefix, email: `${prefix}@example.test`, stripeCustomerId: `cus_${prefix}`,
      createdAt: new Date("2025-01-01T00:00:00Z"),
    } });
    const subs = new Map<string, Stripe.Subscription>();
    const invoices = new Map<string, Stripe.Invoice>();
    let failCancel = false;
    let cancelCalls = 0;
    let linePagesRead = 0;
    let checkoutVisible = true;
    function subscription(id: string, price: string, start = "2026-01-31T00:00:00Z", end = "2027-01-31T00:00:00Z") {
      const sub = {
        id, customer: user.stripeCustomerId, created: Date.parse(start) / 1000,
        status: "active", cancel_at_period_end: false,
        metadata: { userId: user.id, accountCreatedAt: user.createdAt.toISOString() },
        current_period_start: Date.parse(start) / 1000, current_period_end: Date.parse(end) / 1000,
        items: { data: [{ id: `si_${id}`, price: { id: price }, quantity: 1 }] },
        latest_invoice: `in_${id}`,
      } as unknown as Stripe.Subscription;
      subs.set(id, sub);
      invoices.set(`in_${id}`, {
        id: `in_${id}`, paid: true, status: "paid", customer: sub.customer, subscription: sub.id,
        lines: { has_more: false, data: [{ type: "subscription", proration: false, subscription: sub.id,
          subscription_item: sub.items.data[0].id, price: { id: price }, quantity: 1,
          period: { start: sub.current_period_start, end: sub.current_period_end } }] },
      } as unknown as Stripe.Invoice);
      return sub;
    }
    const sub = subscription(`sub_${prefix}`, yearly ? "price_test_starter_yearly" : "price_test_starter_monthly",
      "2026-01-31T00:00:00Z", yearly ? "2027-01-31T00:00:00Z" : "2026-02-28T00:00:00Z");
    const checkout = {
      id: `cs_${prefix}`, mode: "subscription", status: "complete", payment_status: "paid", livemode: true,
      client_reference_id: user.id, customer: user.stripeCustomerId, subscription: sub.id, invoice: `in_${sub.id}`,
      created: sub.created, metadata: { userId: user.id, accountCreatedAt: user.createdAt.toISOString() } as Record<string, string>,
    };
    const fakeStripe = {
      webhooks: { constructEvent: (body: string) => JSON.parse(body) },
      subscriptions: {
        retrieve: async (id: string) => { assert.ok(subs.has(id)); return structuredClone(subs.get(id)!); },
        cancel: async (id: string) => {
          cancelCalls++;
          if (failCancel) throw new Error("Cancellation unavailable");
          subs.get(id)!.status = "canceled";
          return structuredClone(subs.get(id)!);
        },
      },
      invoices: {
        retrieve: async (id: string) => { assert.ok(invoices.has(id)); return structuredClone(invoices.get(id)!); },
        listLineItems: (id: string) => ({ autoPagingToArray: async () => {
          linePagesRead++;
          return structuredClone(invoices.get(id)!.lines.data);
        } }),
      },
      checkout: { sessions: { retrieve: async () => structuredClone(checkout),
        list: async () => ({ data: checkoutVisible ? [structuredClone(checkout)] : [] }),
      } },
    };
    const load = createSourceLoader({ "@/lib/prisma": { prisma: db }, "@/lib/stripe": { getStripe: () => fakeStripe },
      "next/server": { NextResponse: { json: Response.json } },
    });
    const grants = load<GrantModule>("lib/subscription-credit-grant.ts");
    const sync = load<SyncModule>("lib/subscription-sync.ts");
    const finalizer = load<FinalizeModule>("lib/stripe-checkout-finalization.ts");
    const webhook = load<WebhookModule>("app/api/webhooks/stripe/route.ts");
    const deliverInvoice = () => webhook.POST(new Request("http://localhost/api/webhooks/stripe", {
      method: "POST", headers: { "stripe-signature": "fixture-signature" },
      body: JSON.stringify({ id: `evt_${prefix}`, type: "invoice.paid", livemode: true,
        data: { object: invoices.get(`in_${sub.id}`) } }),
    }));
    const grant = () => grants.grantCreditsForCurrentPeriodIfNeeded({
      userId: user.id, sub, invoiceId: `in_${sub.id}`, source: "isolated_test",
      expectedAccountCreatedAt: user.createdAt.toISOString(),
    });
    const cron = (now = "2026-04-30T00:00:00Z") => grants.grantDueYearlyCredits({
      userId: user.id, stripeSubscriptionId: sub.id, now: new Date(now),
    });
    return { user, sub, subs, invoices, checkout, subscription, grants, sync, finalizer, grant, cron, deliverInvoice,
      setFailCancel: (value: boolean) => { failCancel = value; },
      setCheckoutVisible: (value: boolean) => { checkoutVisible = value; },
      cancelCalls: () => cancelCalls, linePagesRead: () => linePagesRead,
      count: () => db.creditBatch.count({ where: { userId: user.id } }),
      record: () => db.subscription.findUniqueOrThrow({ where: { stripeSubscriptionId: sub.id } }),
      cleanup: async () => {
        const ownedSubscriptions = await db.subscription.findMany({
          where: { userId: user.id }, select: { id: true },
        });
        await db.user.deleteMany({ where: { id: user.id } });
        await db.processedStripeEvent.deleteMany({ where: { OR: [
          { id: { contains: prefix } },
          ...ownedSubscriptions.map(({ id }) => ({ id: { startsWith: `grant_yearly_${id}_` } })),
        ] } });
      },
    };
  }

  await t.test("concurrent paid returns and invoices grant monthly credits exactly once", async () => {
    const f = await fixture();
    try {
      const results = await Promise.all(Array.from({ length: 8 }, () => f.grant()));
      assert.equal(results.filter(Boolean).length, 1);
      assert.equal(await f.count(), 1);
      assert.equal((await f.record()).nextCreditAt, null);
      assert.equal((await db.creditBatch.findFirstOrThrow({ where: { userId: f.user.id } })).amount, 200);
    } finally { await f.cleanup(); }
  });

  await t.test("a paid old checkout and invoice cannot fund a later unpaid period", async () => {
    const f = await fixture();
    try {
      f.sub.current_period_start = Date.parse("2026-02-28T00:00:00Z") / 1000;
      f.sub.current_period_end = Date.parse("2026-03-31T00:00:00Z") / 1000;
      assert.equal(await f.grant(), false);
      const result = await f.finalizer.finalizeCheckoutSession({
        sessionId: "old_checkout", expectedUserId: f.user.id,
        expectedAccountCreatedAt: f.user.createdAt.toISOString(), source: "test_return",
      });
      assert.equal(result.creditsGranted, false);
      assert.equal(await f.count(), 0);
      f.sub.items.data[0].price.id = "price_test_pro_yearly";
      assert.equal(await f.grant(), false);
      assert.equal(await f.count(), 0);
    } finally { await f.cleanup(); }
  });

  await t.test("actual invoice webhook and checkout finalizer converge and duplicate delivery returns 200", async () => {
    const f = await fixture();
    try {
      const [first, second, completion] = await Promise.all([
        f.deliverInvoice(), f.deliverInvoice(), f.finalizer.finalizeCheckoutSession({
          sessionId: "paid_checkout", expectedUserId: f.user.id,
          expectedAccountCreatedAt: f.user.createdAt.toISOString(), source: "checkout_return",
        }),
      ]);
      assert.equal(first.status, 200);
      assert.equal(second.status, 200);
      assert.equal(completion.priceKey, "starter_monthly");
      assert.equal(await f.count(), 1);
      const replay = await f.deliverInvoice();
      assert.equal(replay.status, 200);
      assert.equal((await replay.json()).duplicate, true);
    } finally { await f.cleanup(); }
  });

  await t.test("annual first invoice and concurrent catch-up keep one anchored schedule", async () => {
    const f = await fixture(true);
    try {
      f.invoices.get(`in_${f.sub.id}`)!.lines.has_more = true;
      assert.equal(await f.grant(), true);
      assert.equal(f.linePagesRead(), 1);
      assert.equal((await f.record()).nextCreditAt?.toISOString(), "2026-02-28T00:00:00.000Z");
      const [first, second, repeatedInvoice] = await Promise.all([f.cron(), f.cron(), f.grant()]);
      assert.deepEqual([first.granted, second.granted].sort(), [0, 3]);
      assert.equal(first.duplicates + second.duplicates, 0);
      assert.equal(repeatedInvoice, false);
      assert.equal(await f.count(), 4);
      assert.equal((await f.record()).nextCreditAt?.toISOString(), "2026-05-31T00:00:00.000Z");
      assert.deepEqual(await f.cron("2027-01-30T00:00:00Z"), { granted: 8, duplicates: 0 });
      assert.equal(await f.count(), 12);
      assert.equal((await f.record()).nextCreditAt, null);
    } finally { await f.cleanup(); }
  });

  await t.test("invoice-first upgrades cancel the predecessor; failure rolls back and retry grants once", async () => {
    const f = await fixture(true);
    try {
      const old = f.subscription(`old_${f.user.id}`, "price_test_starter_yearly");
      f.sub.items.data[0].price.id = "price_test_pro_yearly";
      f.invoices.get(`in_${f.sub.id}`)!.lines.data[0].price!.id = "price_test_pro_yearly";
      f.sub.metadata.upgradeFromSubscriptionId = old.id;
      f.setFailCancel(true);
      await assert.rejects(f.grant(), /Cancellation unavailable/);
      assert.equal(await f.count(), 0);
      assert.equal(await db.subscription.count({ where: { userId: f.user.id } }), 0);
      f.setFailCancel(false);
      assert.equal((await Promise.all([f.grant(), f.grant()])).filter(Boolean).length, 1);
      assert.equal(old.status, "canceled");
      assert.equal(await f.count(), 1);
      assert.equal(f.cancelCalls(), 2);
      assert.equal((await db.subscription.findUniqueOrThrow({ where: { stripeSubscriptionId: old.id } })).status, "canceled");
    } finally { await f.cleanup(); }
  });

  await t.test("canceled subscriptions ignore delayed active events and a stale cron selection", async () => {
    const f = await fixture(true);
    try {
      await f.grant();
      const delayed = structuredClone(f.sub);
      f.sub.status = "canceled";
      assert.deepEqual(await f.cron(), { granted: 0, duplicates: 0 });
      await f.sync.upsertSubscriptionFromStripe({ userId: f.user.id,
        stripeSubscription: delayed, stripePriceId: delayed.items.data[0].price.id });
      assert.equal((await f.record()).status, "canceled");
      assert.equal((await f.record()).nextCreditAt, null);
      // Also protect against a stale external read once terminal state is known.
      f.sub.status = "active";
      assert.equal(await f.grant(), false);
      assert.equal((await f.record()).status, "canceled");
      assert.equal(await f.count(), 1);
    } finally { await f.cleanup(); }
  });

  await t.test("completed upgrades do not block later paid portal downgrades", async () => {
    const f = await fixture();
    try {
      const old = f.subscription(`old_${f.user.id}`, "price_test_pro_monthly");
      f.sub.items.data[0].price.id = "price_test_max_monthly";
      f.invoices.get(`in_${f.sub.id}`)!.lines.data[0].price!.id = "price_test_max_monthly";
      f.sub.metadata.upgradeFromSubscriptionId = old.id;
      assert.equal(await f.grant(), true);
      f.sub.items.data[0].price.id = "price_test_starter_monthly";
      f.sub.current_period_start = Date.parse("2026-02-28T00:00:00Z") / 1000;
      f.sub.current_period_end = Date.parse("2026-03-31T00:00:00Z") / 1000;
      const line = f.invoices.get(`in_${f.sub.id}`)!.lines.data[0];
      line.price!.id = "price_test_starter_monthly";
      line.period = { start: f.sub.current_period_start, end: f.sub.current_period_end };
      assert.equal(await f.grant(), true);
      assert.equal(await f.count(), 2);
      assert.equal(f.cancelCalls(), 1);
    } finally { await f.cleanup(); }
  });

  await t.test("a legacy open checkout cannot cross account deletion even if its subscription is created later", async () => {
    const f = await fixture();
    try {
      const newEpoch = new Date("2026-08-01T00:00:00Z");
      await db.user.update({ where: { id: f.user.id }, data: { createdAt: newEpoch, stripeCustomerId: null } });
      delete f.sub.metadata.accountCreatedAt;
      delete f.checkout.metadata.accountCreatedAt;
      f.sub.created = Date.parse("2026-08-02T00:00:00Z") / 1000;
      await assert.rejects(f.grants.grantCreditsForCurrentPeriodIfNeeded({ userId: f.user.id,
        sub: f.sub, invoiceId: `in_${f.sub.id}`, source: "legacy_invoice" }), /previous|unverified/);
      await assert.rejects(f.finalizer.finalizeCheckoutSession({ sessionId: "legacy_checkout",
        expectedUserId: f.user.id, expectedAccountCreatedAt: newEpoch.toISOString(), source: "legacy_return",
      }), /previous|no longer/);
      const ignored = await f.deliverInvoice();
      assert.equal(ignored.status, 200);
      assert.equal((await ignored.json()).ignored, true);
      assert.equal(await f.count(), 0);
    } finally { await f.cleanup(); }
  });

  await t.test("a valid legacy checkout still binds the customer and grants after origin verification", async () => {
    const f = await fixture();
    try {
      await db.user.update({ where: { id: f.user.id }, data: { stripeCustomerId: null } });
      delete f.sub.metadata.accountCreatedAt;
      delete f.checkout.metadata.accountCreatedAt;
      f.setCheckoutVisible(false);
      await assert.rejects(f.grant(), /not yet available/);
      assert.equal(await f.count(), 0);
      f.setCheckoutVisible(true);
      assert.equal((await f.deliverInvoice()).status, 200);
      assert.equal(await f.count(), 1);
      assert.equal((await db.user.findUniqueOrThrow({ where: { id: f.user.id } })).stripeCustomerId, f.sub.customer);
      const completion = await f.finalizer.finalizeCheckoutSession({ sessionId: "valid_legacy_checkout",
        expectedUserId: f.user.id, source: "legacy_return",
      });
      assert.equal(completion.creditsGranted, false);
    } finally { await f.cleanup(); }
  });

  await t.test("cron selected before renewal cannot issue or overwrite the old schedule", async () => {
    const f = await fixture(true);
    try {
      await f.grant();
      f.sub.current_period_start = Date.parse("2027-01-31T00:00:00Z") / 1000;
      f.sub.current_period_end = Date.parse("2028-01-31T00:00:00Z") / 1000;
      assert.deepEqual(await f.cron("2027-03-31T00:00:00Z"), { granted: 0, duplicates: 0 });
      assert.equal(await f.count(), 1);
      assert.equal((await f.record()).nextCreditAt, null);
      assert.equal(await f.grant(), false);
    } finally { await f.cleanup(); }
  });

  await t.test("recreated accounts cannot consume old sessions, subscription metadata or customers", async () => {
    const f = await fixture();
    try {
      await db.user.update({ where: { id: f.user.id }, data: { createdAt: new Date("2026-08-01T00:00:00Z"), stripeCustomerId: null } });
      await assert.rejects(f.grant(), /Billing account no longer exists/);
      await assert.rejects(f.grants.grantCreditsForCurrentPeriodIfNeeded({ userId: f.user.id,
        sub: f.sub, invoiceId: `in_${f.sub.id}`, source: "test_webhook" }), /previous account/);
      delete f.sub.metadata.accountCreatedAt;
      await assert.rejects(f.grants.grantCreditsForCurrentPeriodIfNeeded({ userId: f.user.id,
        sub: f.sub, invoiceId: `in_${f.sub.id}`, source: "test_legacy_webhook" }), /previous or unverified/);
      assert.equal(await f.count(), 0);
      assert.equal(await db.subscription.count({ where: { userId: f.user.id } }), 0);
    } finally { await f.cleanup(); }
  });
});
