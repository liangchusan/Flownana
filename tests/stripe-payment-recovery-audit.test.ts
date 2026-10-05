import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { isolatedTestDatabase } from "./helpers/test-database.ts";
import { createSourceLoader } from "./helpers/load-source.ts";
import { getAccountScope, ACCOUNT_SCOPE_HEADER } from "../lib/account-scope.ts";

test("real Stripe sandbox payment recovery and annual upgrade quote", {
  skip: process.env.RUN_STRIPE_SANDBOX_AUDIT !== "true",
}, async (t) => {
  assert.match(process.env.STRIPE_SECRET_KEY ?? "", /^(sk|rk)_test_/);
  assert.notEqual(process.env.VERCEL_ENV, "production");
  const db = isolatedTestDatabase(process.env.FLOWNANA_TEST_DATABASE_URL ?? "");
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { timeout: 20_000, maxNetworkRetries: 0 });
  const load = createSourceLoader({ "@/lib/prisma": { prisma: db }, "@/lib/stripe": { getStripe: () => stripe } });
  const grants = load<typeof import("../lib/subscription-credit-grant")>("lib/subscription-credit-grant.ts");
  const checkout = load<typeof import("../lib/checkout-reservation")>("lib/checkout-reservation.ts");
  const billing = load<typeof import("../lib/billing-summary")>("lib/billing-summary.ts");
  const reconciliation = load<typeof import("../lib/payment-reconciliation")>("lib/payment-reconciliation.ts");
  const plans = load<typeof import("../lib/plans")>("lib/plans.ts");
  t.after(() => db.$disconnect());

  async function fixture(paymentMethod?: string) {
    const id = `stripe_recovery_audit_${randomUUID()}`;
    const user = await db.user.create({ data: { id, email: `${id}@example.test`, name: "Payment Recovery Audit" } });
    const customer = await stripe.customers.create({ email: user.email,
      ...(paymentMethod ? { payment_method: paymentMethod, invoice_settings: { default_payment_method: paymentMethod } } : {}),
      metadata: { audit: "payment-20260922", userId: id } });
    assert.equal(customer.livemode, false);
    await db.user.update({ where: { id }, data: { stripeCustomerId: customer.id } });
    const subs: string[] = [];
    return { user, customer, subs, async cleanup() {
      const reservations = await db.checkoutReservation.findMany({ where: { userId: id } });
      for (const reservation of reservations) if (reservation.stripeSessionId) {
        const session = await stripe.checkout.sessions.retrieve(reservation.stripeSessionId);
        if (session.status === "open") await stripe.checkout.sessions.expire(session.id);
      }
      for (const subId of subs) if ((await stripe.subscriptions.retrieve(subId)).status !== "canceled") await stripe.subscriptions.cancel(subId, { prorate: false });
      await stripe.customers.del(customer.id);
      await db.user.delete({ where: { id } });
    } };
  }

  await t.test("unpaid first invoice receives no credits; payment recovery grants once through signed webhook", async () => {
    const f = await fixture();
    const oldSecret = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_payment_audit_local_fixture";
    try {
      const sub = await stripe.subscriptions.create({ customer: f.customer.id,
        items: [{ price: plans.getStripePriceId("starter_monthly") }], payment_behavior: "default_incomplete",
        metadata: { userId: f.user.id, accountCreatedAt: f.user.createdAt.toISOString() } });
      f.subs.push(sub.id);
      assert.equal(sub.status, "incomplete");
      const invoiceId = sub.latest_invoice as string;
      assert.equal((await stripe.invoices.retrieve(invoiceId)).paid, false);
      const args = { userId: f.user.id, sub, invoiceId, source: "audit_recovery", expectedAccountCreatedAt: f.user.createdAt.toISOString() };
      assert.equal(await grants.grantCreditsForCurrentPeriodIfNeeded(args), false);
      assert.equal(await db.creditBatch.count({ where: { userId: f.user.id } }), 0);
      // Diagnostic, not a claim that this UI behavior is correct.
      const summary = await billing.getBillingSummary(f.user.id, f.user.createdAt.toISOString());
      t.diagnostic(`incomplete subscription is exposed by summary: ${summary.subscription !== null}`);
      assert.equal(summary.paymentIssue?.status, "incomplete");
      const recoveryLoad = createSourceLoader({ "@/lib/prisma": { prisma: db }, "@/lib/stripe": { getStripe: () => stripe },
        "@/lib/auth-options": { authOptions: {} },
        "next-auth": { getServerSession: async () => ({ user: { id: f.user.id, accountCreatedAt: f.user.createdAt.toISOString() } }) },
        "next/server": { NextResponse: { json: Response.json } },
      });
      const recovery = recoveryLoad<typeof import("../app/api/stripe/payment-recovery/route")>("app/api/stripe/payment-recovery/route.ts");
      const recoveryRequest = new Request("http://localhost/api/stripe/payment-recovery", { method: "POST",
        headers: { [ACCOUNT_SCOPE_HEADER]: getAccountScope({ id: f.user.id, accountCreatedAt: f.user.createdAt.toISOString() })! } });
      const recoveryResponse = await recovery.POST(recoveryRequest);
      assert.equal(recoveryResponse.status, 200);
      assert.match((await recoveryResponse.json()).url, /^https:\/\/invoice\.stripe\.com\//);
      await assert.rejects(checkout.createReservedCheckout({ userId: f.user.id,
        accountCreatedAt: f.user.createdAt.toISOString(), kind: "purchase", priceKey: "pro_monthly", baseUrl: "http://localhost:3110" }), /Resolve your existing subscription/);
      const pm = await stripe.paymentMethods.attach("pm_card_visa", { customer: f.customer.id });
      const paid = await stripe.invoices.pay(invoiceId, { payment_method: pm.id });
      assert.equal(paid.paid, true);
      const webhook = load<typeof import("../app/api/webhooks/stripe/route")>("app/api/webhooks/stripe/route.ts");
      const eventId = `evt_payment_audit_${randomUUID()}`;
      const payload = JSON.stringify({ id: eventId, type: "invoice.paid", livemode: false, data: { object: paid } });
      const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! });
      const request = (sig: string, body = payload) => new Request("http://localhost/api/webhooks/stripe", { method: "POST", body, headers: { "stripe-signature": sig } });
      assert.equal((await webhook.POST(request(signature))).status, 200);
      const replay = await webhook.POST(request(signature));
      assert.equal(replay.status, 200);
      assert.equal((await replay.json()).duplicate, true);
      const credits = await db.creditBatch.aggregate({ where: { userId: f.user.id }, _sum: { remaining: true }, _count: true });
      assert.equal(credits._sum.remaining, 200);
      assert.equal(credits._count, 1);
      assert.equal((await webhook.POST(request("invalid", "{}"))).status, 400);
      assert.equal((await billing.getBillingSummary(f.user.id)).subscription?.status, "active");
      assert.equal((await recovery.POST(recoveryRequest)).status, 404);
      await db.processedStripeEvent.deleteMany({ where: { id: eventId } });
    } finally {
      if (oldSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET; else process.env.STRIPE_WEBHOOK_SECRET = oldSecret;
      await f.cleanup();
    }
  });

  await t.test("Billing catches up a paid Hosted Invoice without waiting for a webhook", async () => {
    const f = await fixture();
    try {
      const sub = await stripe.subscriptions.create({ customer: f.customer.id,
        items: [{ price: plans.getStripePriceId("starter_monthly") }], payment_behavior: "default_incomplete",
        metadata: { userId: f.user.id, accountCreatedAt: f.user.createdAt.toISOString() } });
      f.subs.push(sub.id);
      const invoiceId = sub.latest_invoice as string;
      assert.equal(await grants.grantCreditsForCurrentPeriodIfNeeded({ userId: f.user.id, sub, invoiceId,
        source: "audit_unpaid", expectedAccountCreatedAt: f.user.createdAt.toISOString() }), false);
      const pm = await stripe.paymentMethods.attach("pm_card_visa", { customer: f.customer.id });
      assert.equal((await stripe.invoices.pay(invoiceId, { payment_method: pm.id })).paid, true);
      assert.equal(await db.creditBatch.count({ where: { userId: f.user.id } }), 0);
      await reconciliation.reconcilePendingPayment(f.user.id, f.user.createdAt.toISOString());
      assert.equal((await billing.getBillingSummary(f.user.id)).subscription?.status, "active");
      assert.equal((await billing.getBillingSummary(f.user.id)).credits.current, 200);
      await reconciliation.reconcilePendingPayment(f.user.id, f.user.createdAt.toISOString());
      assert.equal(await db.creditBatch.count({ where: { userId: f.user.id } }), 1);
      await reconciliation.reconcilePendingPayment(f.user.id, new Date(0).toISOString());
      assert.equal(await db.creditBatch.count({ where: { userId: f.user.id } }), 1);
    } finally { await f.cleanup(); }
  });

  await t.test("paid Starter annual produces an 11-month credit and a single correctly discounted Pro checkout", async () => {
    const f = await fixture("pm_card_visa");
    try {
      const sub = await stripe.subscriptions.create({ customer: f.customer.id,
        items: [{ price: plans.getStripePriceId("starter_yearly") }], payment_behavior: "error_if_incomplete",
        metadata: { userId: f.user.id, accountCreatedAt: f.user.createdAt.toISOString() } });
      f.subs.push(sub.id);
      assert.equal(await grants.grantCreditsForCurrentPeriodIfNeeded({ userId: f.user.id, sub,
        invoiceId: sub.latest_invoice as string, source: "audit_upgrade", expectedAccountCreatedAt: f.user.createdAt.toISOString() }), true);
      const quote = await checkout.getReservedUpgradeQuote(f.user.id, f.user.createdAt.toISOString(), "pro_yearly");
      assert.equal(quote.remainingMonths, 11);
      assert.equal(quote.creditAmountCents, 8800);
      assert.equal(quote.targetAmountCents, 28800);
      assert.equal(quote.payableAmountCents, 20000);
      const params = { userId: f.user.id, accountCreatedAt: f.user.createdAt.toISOString(),
        kind: "upgrade" as const, priceKey: "pro_yearly" as const, baseUrl: "http://localhost:3110" };
      const first = await checkout.createReservedCheckout(params);
      assert.equal((await checkout.createReservedCheckout(params)).url, first.url);
      const reservation = await db.checkoutReservation.findFirstOrThrow({ where: { userId: f.user.id } });
      const session = await stripe.checkout.sessions.retrieve(reservation.stripeSessionId!);
      assert.equal(session.livemode, false);
      assert.equal(session.amount_total, 20000);
      assert.equal(session.total_details?.amount_discount, 8800);
      assert.equal(session.metadata?.upgradeFromSubscriptionId, sub.id);
      assert.equal((await stripe.subscriptions.retrieve(sub.id)).status, "active");
      assert.equal(await db.creditBatch.count({ where: { userId: f.user.id } }), 1);
      await assert.rejects(checkout.getReservedUpgradeQuote(f.user.id, f.user.createdAt.toISOString(), "pro_monthly"), /not supported/);
    } finally { await f.cleanup(); }
  });

  await t.test("an attached card that declines keeps the first invoice unpaid and grants no credits", async () => {
    const f = await fixture("pm_card_chargeCustomerFail");
    try {
      const sub = await stripe.subscriptions.create({ customer: f.customer.id,
        items: [{ price: plans.getStripePriceId("starter_monthly") }], payment_behavior: "allow_incomplete",
        metadata: { userId: f.user.id, accountCreatedAt: f.user.createdAt.toISOString() } });
      f.subs.push(sub.id);
      assert.equal(sub.status, "incomplete");
      const invoiceId = sub.latest_invoice as string;
      assert.equal((await stripe.invoices.retrieve(invoiceId)).paid, false);
      assert.equal(await grants.grantCreditsForCurrentPeriodIfNeeded({ userId: f.user.id, sub, invoiceId,
        source: "audit_decline", expectedAccountCreatedAt: f.user.createdAt.toISOString() }), false);
      assert.equal(await db.creditBatch.count({ where: { userId: f.user.id } }), 0);
      assert.equal((await billing.getBillingSummary(f.user.id)).paymentIssue?.status, "incomplete");
    } finally { await f.cleanup(); }
  });

  await t.test("a 3DS test payment remains pending authentication, not paid", async () => {
    const intent = await stripe.paymentIntents.create({ amount: 1600, currency: "usd",
      payment_method: "pm_card_authenticationRequired", payment_method_types: ["card"], confirm: true });
    try {
      assert.equal(intent.status, "requires_action");
      assert.ok(intent.next_action);
    } finally {
      if (intent.status !== "succeeded" && intent.status !== "canceled") await stripe.paymentIntents.cancel(intent.id);
    }
  });
});
