import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { createSourceLoader } from "./helpers/load-source.ts";
import { isolatedTestDatabase } from "./helpers/test-database.ts";
import { getAccountScope, ACCOUNT_SCOPE_HEADER } from "../lib/account-scope.ts";

const databaseUrl = process.env.FLOWNANA_TEST_DATABASE_URL;

test("durable checkout reservations with isolated PostgreSQL and Stripe fault injection", { skip: !databaseUrl }, async (t) => {
  const db = isolatedTestDatabase(databaseUrl!);
  t.after(() => db.$disconnect());
  const prices: Record<string, any> = {};
  for (const [plan, monthly, yearly] of [["starter", 1600, 9600], ["pro", 4800, 28800], ["max", 9600, 57600]] as const) {
    for (const [cycle, amount] of [["monthly", monthly], ["yearly", yearly]] as const) {
      const id = `price_fixture_${plan}_${cycle}`;
      process.env[`STRIPE_PRICE_${plan.toUpperCase()}_${cycle.toUpperCase()}`] = id;
      prices[id] = { id, active: true, unit_amount: amount, currency: "usd", recurring: { interval: cycle === "yearly" ? "year" : "month", interval_count: 1 } };
    }
  }
  process.env.STRIPE_WEBHOOK_SECRET = "isolated_webhook_fixture";

  async function fixture() {
    const id = `reservation_test_${randomUUID()}`;
    const user = await db.user.create({ data: { id, email: `${id}@example.invalid`, createdAt: new Date("2026-01-01T00:00:00Z"), stripeCustomerId: `cus_${id}` } });
    const sessions = new Map<string, any>(), subs = new Map<string, any>(), invoices = new Map<string, any>();
    const requests = new Map<string, { params: any; id: string }>(), couponRequests = new Map<string, any>();
    let creates = 0, peakOpen = 0, losses = 0, hideSessions = false, failCancel = false, failExpire = false;
    let afterCreate: (() => Promise<void>) | undefined;
    const stripe = {
      prices: { retrieve: async (id: string) => { assert.ok(prices[id]); return structuredClone(prices[id]); } },
      coupons: { create: async (params: any, options: any) => {
        assert.ok(options.idempotencyKey);
        const old = couponRequests.get(options.idempotencyKey);
        if (old) assert.deepEqual(old, params);
        else couponRequests.set(options.idempotencyKey, structuredClone(params));
        return { id: params.id };
      } },
      checkout: { sessions: {
        create: async (params: any, options: any) => {
          assert.ok(options.idempotencyKey);
          let saved = requests.get(options.idempotencyKey);
          if (saved) assert.deepEqual(saved.params, params, "Retries must retain byte-equivalent parameters");
          else {
            creates++;
            const sessionId = `cs_${id}_${creates}`;
            saved = { params: structuredClone(params), id: sessionId };
            requests.set(options.idempotencyKey, saved);
            sessions.set(sessionId, { id: sessionId, mode: "subscription", status: "open", payment_status: "unpaid", livemode: true,
              created: Math.floor(Date.now() / 1000), expires_at: params.expires_at, metadata: params.metadata,
              client_reference_id: params.client_reference_id, customer: params.customer || null,
              url: `https://checkout.example/${sessionId}` });
            peakOpen = Math.max(peakOpen, [...sessions.values()].filter((session) => session.status === "open").length);
          }
          await afterCreate?.();
          if (losses > 0) { losses--; throw new Error("Stripe accepted creation but response was lost"); }
          return structuredClone(sessions.get(saved.id));
        },
        retrieve: async (id: string) => { assert.ok(sessions.has(id)); return structuredClone(sessions.get(id)); },
        expire: async (id: string) => {
          if (failExpire) throw new Error("Expiration not confirmed");
          const session = sessions.get(id);
          if (session.status !== "open") throw new Error("Session not open");
          session.status = "expired"; session.url = null;
          return structuredClone(session);
        },
        list: async (filter: any) => ({ has_more: false, data: hideSessions ? [] : [...sessions.values()].filter((session) =>
          (!filter.subscription || session.subscription === filter.subscription) &&
          (!filter.status || session.status === filter.status) &&
          (!filter.created?.gte || session.created >= filter.created.gte)).map((value) => structuredClone(value)) }),
      } },
      subscriptions: {
        retrieve: async (id: string) => { assert.ok(subs.has(id)); return structuredClone(subs.get(id)); },
        cancel: async (id: string) => { if (failCancel) throw new Error("Cancellation failed"); subs.get(id).status = "canceled"; return structuredClone(subs.get(id)); },
        list: () => ({ autoPagingToArray: async () => [...subs.values()].map((value) => structuredClone(value)) }),
      },
      invoices: { retrieve: async (id: string) => { assert.ok(invoices.has(id)); return structuredClone(invoices.get(id)); } },
      webhooks: { constructEvent: (body: string) => JSON.parse(body) },
    };
    const load = createSourceLoader({ "@/lib/prisma": { prisma: db }, "@/lib/stripe": { getStripe: () => stripe },
      "@/lib/auth-options": { authOptions: {} }, "next-auth": { getServerSession: async () => ({ user: { ...user, accountCreatedAt: user.createdAt.toISOString() } }) },
      "next/server": { NextResponse: { json: Response.json } },
    });
    const reservation = load<typeof import("../lib/checkout-reservation")>("lib/checkout-reservation.ts");
    const grants = load<typeof import("../lib/subscription-credit-grant")>("lib/subscription-credit-grant.ts");
    const sync = load<typeof import("../lib/subscription-sync")>("lib/subscription-sync.ts");
    const finalizer = load<typeof import("../lib/stripe-checkout-finalization")>("lib/stripe-checkout-finalization.ts");
    const webhook = load<typeof import("../app/api/webhooks/stripe/route")>("app/api/webhooks/stripe/route.ts");
    const create = (priceKey = "starter_monthly", kind = "purchase") => reservation.createReservedCheckout({ userId: id, accountCreatedAt: user.createdAt.toISOString(), kind: kind as "purchase" | "upgrade", priceKey: priceKey as any, baseUrl: "http://localhost" });
    function makeSubscription(subId: string, priceId: string, metadata: any = {}) {
      const sub = { id: subId, customer: user.stripeCustomerId, status: "active", cancel_at_period_end: false,
        created: Date.parse("2026-08-01T00:00:00Z") / 1000, current_period_start: Date.parse("2026-08-01T00:00:00Z") / 1000,
        current_period_end: Date.parse(priceId.endsWith("yearly") ? "2027-08-01T00:00:00Z" : "2026-09-01T00:00:00Z") / 1000,
        metadata: { userId: id, accountCreatedAt: user.createdAt.toISOString(), ...metadata },
        items: { data: [{ id: `si_${subId}`, quantity: 1, price: prices[priceId] }] }, latest_invoice: `in_${subId}` };
      subs.set(subId, sub);
      invoices.set(sub.latest_invoice, { id: sub.latest_invoice, paid: true, status: "paid", customer: sub.customer, subscription: sub.id,
        lines: { has_more: false, data: [{ type: "subscription", proration: false, subscription: sub.id, subscription_item: sub.items.data[0].id,
          price: sub.items.data[0].price, quantity: 1, period: { start: sub.current_period_start, end: sub.current_period_end } }] } });
      return sub;
    }
    const grant = (sub: any) => grants.grantCreditsForCurrentPeriodIfNeeded({ userId: id, sub, invoiceId: sub.latest_invoice, source: "fixture", expectedAccountCreatedAt: user.createdAt.toISOString() });
    async function predecessor() {
      const sub = makeSubscription(`sub_old_${id}`, "price_fixture_starter_yearly");
      await grant(sub);
      return sub;
    }
    function pay(sessionId: string) {
      const session = sessions.get(sessionId);
      const request = [...requests.values()].find((item) => item.id === sessionId)!.params;
      const sub = makeSubscription(`sub_${sessionId}`, request.line_items[0].price, request.subscription_data.metadata);
      Object.assign(session, { status: "complete", payment_status: "paid", subscription: sub.id, invoice: sub.latest_invoice, customer: user.stripeCustomerId });
      return sub;
    }
    const routePost = async (priceKey = "starter_monthly", path = "checkout") => load<any>(`app/api/stripe/${path}/route.ts`).POST(new Request(`http://localhost/api/stripe/${path}`, { method: "POST", headers: { [ACCOUNT_SCOPE_HEADER]: getAccountScope({ id, accountCreatedAt: user.createdAt.toISOString() })! }, body: JSON.stringify({ priceKey }) }));
    const deletion = load<typeof import("../app/api/account/route")>("app/api/account/route.ts");
    return { user, stripe, sessions, subs, invoices, requests, couponRequests, reservation, create, makeSubscription, grant, grants, predecessor, pay, routePost, sync, finalizer, webhook, deletion,
      creates: () => creates, peakOpen: () => peakOpen,
      faults: (faults: { losses?: number; hideSessions?: boolean; failCancel?: boolean; failExpire?: boolean; afterCreate?: () => Promise<void> }) => {
        losses = faults.losses ?? losses; hideSessions = faults.hideSessions ?? hideSessions; failCancel = faults.failCancel ?? failCancel; failExpire = faults.failExpire ?? failExpire; afterCreate = faults.afterCreate;
      },
      cleanup: async () => { await db.user.deleteMany({ where: { id } }); await db.processedStripeEvent.deleteMany({ where: { id: { contains: id } } }); },
    };
  }

  await t.test("actual purchase route merges ten concurrent clicks into one durable payable checkout", async () => {
    const f = await fixture();
    try {
      const replies = await Promise.all(Array.from({ length: 10 }, () => f.routePost()));
      assert.ok(replies.every((reply) => reply.status === 200));
      const urls = await Promise.all(replies.map((reply) => reply.json().then((data: any) => data.url)));
      assert.equal(new Set(urls).size, 1); assert.equal(f.creates(), 1); assert.equal(f.peakOpen(), 1);
      assert.equal(await db.checkoutReservation.count({ where: { userId: f.user.id, closedAt: null } }), 1);
    } finally { await f.cleanup(); }
  });

  await t.test("lost create reply and transaction rollback retry the exact same coupon and session intent", async () => {
    const f = await fixture();
    try {
      await f.predecessor();
      f.faults({ losses: 1, hideSessions: true });
      await assert.rejects(f.create("pro_yearly", "upgrade"), /previous checkout/);
      const row = await db.checkoutReservation.findFirstOrThrow({ where: { userId: f.user.id } });
      assert.equal(row.stripeSessionId, null); assert.equal(row.status, "creating");
      f.faults({ hideSessions: false });
      const restored = await f.create("pro_yearly", "upgrade");
      assert.match(restored.url, /checkout\.example/); assert.equal(f.creates(), 1); assert.equal(f.couponRequests.size, 1);
      assert.deepEqual((await db.checkoutReservation.findUniqueOrThrow({ where: { id: row.id } })).sessionParams, row.sessionParams);
    } finally { await f.cleanup(); }
  });

  await t.test("dispatch only follows a committed intent and concurrent upgrade POSTs share one coupon", async () => {
    const f = await fixture();
    try {
      await f.predecessor();
      f.faults({ afterCreate: async () => {
        // Separate connection cannot see uncommitted reservation creation.
        assert.equal(await db.checkoutReservation.count({ where: { userId: f.user.id, closedAt: null } }), 1);
      } });
      const replies = await Promise.all(Array.from({ length: 6 }, () => f.routePost("pro_yearly", "change-plan")));
      assert.ok(replies.every((reply) => reply.status === 200));
      assert.equal(f.creates(), 1); assert.equal(f.couponRequests.size, 1);
    } finally { await f.cleanup(); }
  });

  await t.test("a fulfilled reservation allows a later paid renewal and Billing Portal plan change", async () => {
    const f = await fixture();
    try {
      await f.predecessor(); await f.create("pro_yearly", "upgrade");
      const paid = f.pay([...f.sessions.keys()][0]);
      assert.equal(await f.grant(paid), true);
      const renewed = f.makeSubscription(paid.id, "price_fixture_starter_monthly", paid.metadata);
      renewed.current_period_start = Date.parse("2027-08-01T00:00:00Z") / 1000;
      renewed.current_period_end = Date.parse("2027-09-01T00:00:00Z") / 1000;
      f.invoices.get(renewed.latest_invoice).lines.data[0].period = { start: renewed.current_period_start, end: renewed.current_period_end };
      assert.equal(await f.grant(renewed), true);
      assert.equal(await f.grant(renewed), false);
      assert.equal(await db.creditBatch.count({ where: { userId: f.user.id } }), 3);
      assert.equal(await db.upgradeConsumption.count({ where: { userId: f.user.id } }), 1);
    } finally { await f.cleanup(); }
  });

  await t.test("two paid legacy successors cannot both claim the same predecessor", async () => {
    const f = await fixture();
    try {
      const old = await f.predecessor();
      const first = f.makeSubscription(`sub_legacy_a_${f.user.id}`, "price_fixture_pro_yearly", { upgradeFromSubscriptionId: old.id });
      const second = f.makeSubscription(`sub_legacy_b_${f.user.id}`, "price_fixture_max_yearly", { upgradeFromSubscriptionId: old.id });
      const results = await Promise.allSettled([f.grant(first), f.grant(second)]);
      assert.equal(results.filter((result) => result.status === "fulfilled" && result.value).length, 1);
      assert.equal(results.filter((result) => result.status === "rejected").length, 1);
      assert.equal(await db.creditBatch.count({ where: { userId: f.user.id } }), 2);
      assert.equal(await db.upgradeConsumption.count({ where: { userId: f.user.id } }), 1);
    } finally { await f.cleanup(); }
  });

  await t.test("switching plans must confirm expiry; concurrent different plans never have two open sessions", async () => {
    const f = await fixture();
    try {
      await f.create(); f.faults({ failExpire: true });
      await assert.rejects(f.create("pro_monthly"), /previous checkout/); assert.equal(f.creates(), 1);
      f.faults({ failExpire: false });
      await Promise.allSettled([f.create("pro_monthly"), f.create("max_monthly"), f.create("starter_yearly")]);
      await f.create("starter_yearly"); // one uncontended retry remains usable after contention
      assert.equal(f.peakOpen(), 1);
      assert.equal([...f.sessions.values()].filter((session) => session.status === "open").length, 1);
    } finally { await f.cleanup(); }
  });

  await t.test("invoice-first and return-page races consume the predecessor and grant once, with cancellation retry", async () => {
    const f = await fixture();
    try {
      const old = await f.predecessor(); await f.create("pro_yearly", "upgrade");
      const session = [...f.sessions.values()][0], sub = f.pay(session.id);
      f.faults({ failCancel: true });
      await assert.rejects(f.grant(sub), /Cancellation failed/);
      assert.equal(await db.upgradeConsumption.count({ where: { userId: f.user.id } }), 0);
      assert.equal((await db.checkoutReservation.findFirstOrThrow({ where: { userId: f.user.id } })).closedAt, null);
      assert.match((await f.create("max_yearly", "upgrade")).url, /account\/billing/);
      assert.equal(f.creates(), 1);
      f.faults({ failCancel: false });
      const webhookRequest = new Request("http://localhost/api/webhooks/stripe", { method: "POST", headers: { "stripe-signature": "fixture" },
        body: JSON.stringify({ id: `evt_${f.user.id}`, type: "invoice.paid", livemode: true, data: { object: f.invoices.get(sub.latest_invoice) } }) });
      const [event] = await Promise.all([f.webhook.POST(webhookRequest), f.finalizer.finalizeCheckoutSession({ sessionId: session.id, expectedUserId: f.user.id, source: "return" })]);
      assert.equal(event.status, 200);
      assert.equal((await db.upgradeConsumption.findUniqueOrThrow({ where: { predecessorId: old.id } })).successorId, sub.id);
      assert.equal(await db.creditBatch.count({ where: { userId: f.user.id } }), 2);
      assert.equal((await db.checkoutReservation.findFirstOrThrow({ where: { userId: f.user.id } })).status, "fulfilled");
      const duplicate = f.makeSubscription(`sub_duplicate_${f.user.id}`, "price_fixture_max_yearly", { upgradeFromSubscriptionId: old.id });
      await assert.rejects(f.grant(duplicate), /already consumed/);
      await assert.rejects(f.sync.upsertSubscriptionFromStripe({ userId: f.user.id, stripeSubscription: duplicate as any, stripePriceId: duplicate.items.data[0].price.id }), /already consumed/);
      assert.equal(await db.creditBatch.count({ where: { userId: f.user.id } }), 2);
    } finally { await f.cleanup(); }
  });

  await t.test("legacy paid upgrades cannot be consumed again after the new empty ledger is installed", async () => {
    const f = await fixture();
    try {
      const old = await f.predecessor();
      const paid = f.makeSubscription(`sub_paid_${f.user.id}`, "price_fixture_pro_yearly", { upgradeFromSubscriptionId: old.id });
      await f.grant(paid);
      await db.upgradeConsumption.deleteMany({ where: { userId: f.user.id } }); // model a pre-migration successful upgrade
      const late = f.makeSubscription(`sub_late_${f.user.id}`, "price_fixture_max_yearly", { upgradeFromSubscriptionId: old.id });
      await assert.rejects(f.grant(late), /Legacy upgrade predecessor already consumed/);
      assert.equal(await db.creditBatch.count({ where: { userId: f.user.id } }), 2);
    } finally { await f.cleanup(); }
  });

  await t.test("unknown expired creation never creates a new session with an old idempotency key", async () => {
    const f = await fixture();
    try {
      f.faults({ losses: 1, hideSessions: true }); await assert.rejects(f.create());
      await db.checkoutReservation.updateMany({ where: { userId: f.user.id }, data: { expiresAt: new Date(Date.now() - 86_400_000) } });
      await assert.rejects(f.create()); assert.equal(f.creates(), 1);
      f.faults({ hideSessions: false });
      const session = [...f.sessions.values()][0]; session.status = "expired";
      await f.create(); assert.equal(f.creates(), 2);
    } finally { await f.cleanup(); }
  });

  await t.test("legacy customer-less open checkouts are expired before issuing a new checkout", async () => {
    const f = await fixture();
    try {
      await db.user.update({ where: { id: f.user.id }, data: { stripeCustomerId: null } });
      const legacy = { id: `cs_legacy_${f.user.id}`, mode: "subscription", status: "open", customer: null,
        created: Math.floor(Date.now() / 1000), client_reference_id: f.user.id, metadata: { userId: f.user.id } };
      f.sessions.set(legacy.id, legacy);
      await f.create();
      assert.equal(legacy.status, "expired"); assert.equal(f.peakOpen(), 1);
    } finally { await f.cleanup(); }
  });

  await t.test("a completed legacy checkout without reconciled credit grant blocks new payment", async () => {
    const f = await fixture();
    try {
      const legacy = { id: `cs_legacy_${f.user.id}`, mode: "subscription", status: "complete", subscription: `sub_unprocessed_${f.user.id}`,
        created: Math.floor(Date.now() / 1000), client_reference_id: f.user.id, metadata: { userId: f.user.id } };
      f.sessions.set(legacy.id, legacy);
      await assert.rejects(f.create(), /previous checkout/); assert.equal(f.creates(), 0);
    } finally { await f.cleanup(); }
  });

  await t.test("quote retries retain the reserved price; annual credit grant expires that quote before issuing its value", async () => {
    const f = await fixture();
    try {
      const old = await f.predecessor(); await f.create("pro_yearly", "upgrade");
      const quoted = await f.reservation.getReservedUpgradeQuote(f.user.id, f.user.createdAt.toISOString(), "pro_yearly");
      assert.equal(quoted.remainingMonths, 11);
      await f.grant(old); // replaying an already paid invoice must not invalidate checkout
      assert.equal([...f.sessions.values()][0].status, "open");
      const result = await f.grants.grantDueYearlyCredits({ userId: f.user.id, stripeSubscriptionId: old.id, now: new Date("2026-09-02T00:00:00Z") });
      assert.equal(result.granted, 1); assert.equal([...f.sessions.values()][0].status, "expired");
      const next = await f.reservation.getReservedUpgradeQuote(f.user.id, f.user.createdAt.toISOString(), "pro_yearly");
      assert.equal(next.remainingMonths, 10); assert.ok(next.creditAmountCents < quoted.creditAmountCents);
    } finally { await f.cleanup(); }
  });

  await t.test("a reservation cannot bind another subscription or a re-registered account", async () => {
    const f = await fixture();
    try {
      await f.create(); const session = [...f.sessions.values()][0]; const sub = f.pay(session.id);
      const copied = f.makeSubscription(`sub_copy_${f.user.id}`, "price_fixture_starter_monthly", sub.metadata);
      await assert.rejects(f.grant(copied), /previous checkout/);
      assert.equal(await db.creditBatch.count({ where: { userId: f.user.id } }), 0);
      await f.grant(sub);
      await db.user.delete({ where: { id: f.user.id } });
      await db.user.create({ data: { id: f.user.id, email: f.user.email } });
      await assert.rejects(f.create(), /account no longer exists/); assert.equal(f.creates(), 1);
    } finally { await f.cleanup(); }
  });

  await t.test("new tables deny Data API roles and enforce the partial unique reservation index", async () => {
    const f = await fixture();
    try {
      for (const name of ["CheckoutReservation", "UpgradeConsumption"]) {
        const rls = await db.$queryRaw<Array<{ enabled: boolean }>>`SELECT relrowsecurity AS enabled FROM pg_class WHERE oid = ${`public."${name}"`}::regclass`;
        assert.equal(rls[0].enabled, true);
        for (const role of ["anon", "authenticated", "service_role"]) {
          for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
            const access = await db.$queryRaw<Array<{ allowed: boolean }>>`SELECT has_table_privilege(${role}, ${`public."${name}"`}, ${privilege}) AS allowed`;
            assert.equal(access[0].allowed, false);
          }
        }
      }
      await f.create(); const row = await db.checkoutReservation.findFirstOrThrow({ where: { userId: f.user.id } });
      await assert.rejects(db.checkoutReservation.create({ data: { ...row, id: randomUUID(), stripeSessionId: null, sessionParams: row.sessionParams as Prisma.InputJsonValue, couponParams: undefined } }), (error: any) => error.code === "P2002");
    } finally { await f.cleanup(); }
  });

  await t.test("actual account DELETE expires the user's unresolved payable checkout before removing the account", async () => {
    const f = await fixture();
    try {
      await f.create();
      const reply = await f.deletion.DELETE(new Request("http://localhost/api/account", { method: "DELETE", body: JSON.stringify({ confirmation: "DELETE" }) }));
      assert.equal(reply.status, 200);
      assert.equal([...f.sessions.values()][0].status, "expired");
      assert.equal(await db.user.findUnique({ where: { id: f.user.id } }), null);
    } finally { await f.cleanup(); }
  });

  await t.test("account deletion reconciles customer-less legacy checkout and does not erase an uncertain payment", async () => {
    const f = await fixture();
    try {
      await db.user.update({ where: { id: f.user.id }, data: { stripeCustomerId: null } });
      const legacy = { id: `cs_legacy_${f.user.id}`, mode: "subscription", status: "open", customer: null,
        created: Math.floor(Date.now() / 1000), client_reference_id: f.user.id, metadata: { userId: f.user.id } };
      f.sessions.set(legacy.id, legacy);
      const request = () => new Request("http://localhost/api/account", { method: "DELETE", body: JSON.stringify({ confirmation: "DELETE" }) });
      f.faults({ failExpire: true });
      assert.equal((await f.deletion.DELETE(request())).status, 409);
      assert.ok(await db.user.findUnique({ where: { id: f.user.id } }));
      f.faults({ failExpire: false });
      assert.equal((await f.deletion.DELETE(request())).status, 200);
      assert.equal(legacy.status, "expired"); assert.equal(f.creates(), 0);
    } finally { await f.cleanup(); }
  });

  await t.test("annual issuance also expires pre-migration upgrade quotes before distributing their value", async () => {
    const f = await fixture();
    try {
      const old = await f.predecessor();
      const legacy = { id: `cs_legacy_quote_${f.user.id}`, mode: "subscription", status: "open", customer: f.user.stripeCustomerId,
        created: Math.floor(Date.now() / 1000), client_reference_id: f.user.id,
        metadata: { userId: f.user.id, upgradeFromSubscriptionId: old.id } };
      f.sessions.set(legacy.id, legacy);
      f.faults({ failExpire: true });
      await assert.rejects(f.grants.grantDueYearlyCredits({ userId: f.user.id, stripeSubscriptionId: old.id, now: new Date("2026-09-01T00:00:00Z") }));
      assert.equal(await db.creditBatch.count({ where: { userId: f.user.id } }), 1);
      f.faults({ failExpire: false });
      const result = await f.grants.grantDueYearlyCredits({ userId: f.user.id, stripeSubscriptionId: old.id, now: new Date("2026-09-01T00:00:00Z") });
      assert.equal(result.granted, 1); assert.equal(legacy.status, "expired");
    } finally { await f.cleanup(); }
  });

  await t.test("account deletion cannot race a dispatched checkout or erase an unresolved reservation", async () => {
    const f = await fixture();
    try {
      await f.create();
      f.faults({ failExpire: true });
      const locked = createSourceLoader({ "@/lib/prisma": { prisma: db } })<typeof import("../lib/billing-transaction")>("lib/billing-transaction.ts");
      await assert.rejects(locked.withBillingUser(f.user.id, async (tx, user) => {
        await f.reservation.closeCheckoutBeforeAccountDeletion(tx, user); await tx.user.delete({ where: { id: user.id } });
      }));
      assert.ok(await db.user.findUnique({ where: { id: f.user.id } }));
      f.faults({ failExpire: false });
      await locked.withBillingUser(f.user.id, async (tx, user) => {
        await f.reservation.closeCheckoutBeforeAccountDeletion(tx, user); await tx.user.delete({ where: { id: user.id } });
      });
      assert.ok([...f.sessions.values()].every((session) => session.status === "expired"));
      await assert.rejects(f.create(), /account no longer exists/);
    } finally { await f.cleanup(); }
  });
});
