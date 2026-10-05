import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { isolatedTestDatabase } from "./helpers/test-database.ts";
import { createSourceLoader } from "./helpers/load-source.ts";

// Explicit opt-in: real Stripe TEST objects, isolated local PostgreSQL only.
// Never accepts a live key or a business database. Does not send card numbers.
test("real Stripe sandbox checkout catalog and paid-credit integration", {
  skip: process.env.RUN_STRIPE_SANDBOX_AUDIT !== "true",
}, async (t) => {
  assert.match(process.env.STRIPE_SECRET_KEY ?? "", /^(sk|rk)_test_/);
  assert.notEqual(process.env.VERCEL_ENV, "production");
  const db = isolatedTestDatabase(process.env.FLOWNANA_TEST_DATABASE_URL ?? "");
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { timeout: 20_000, maxNetworkRetries: 0 });
  const load = createSourceLoader({ "@/lib/prisma": { prisma: db }, "@/lib/stripe": { getStripe: () => stripe } });
  const reservations = load<typeof import("../lib/checkout-reservation")>("lib/checkout-reservation.ts");
  const grants = load<typeof import("../lib/subscription-credit-grant")>("lib/subscription-credit-grant.ts");
  const plans = load<typeof import("../lib/plans")>("lib/plans.ts");
  t.after(() => db.$disconnect());

  for (const priceKey of ["starter_monthly", "starter_yearly", "pro_monthly", "pro_yearly", "max_monthly", "max_yearly"] as const) {
    await t.test(`${priceKey}: actual Checkout amount, reservation reuse, URLs and expiration`, async () => {
      const id = `stripe_audit_${randomUUID()}`;
      const user = await db.user.create({ data: { id, email: `${id}@example.test`, name: "Payment Audit" } });
      let sessionId: string | null = null;
      try {
        const params = { userId: id, accountCreatedAt: user.createdAt.toISOString(), kind: "purchase" as const, priceKey, baseUrl: "http://localhost:3110",
          ...(priceKey === "starter_yearly" ? { returnTo: "/image?mode=agent" } : {}) };
        const first = await reservations.createReservedCheckout(params);
        const reservation = await db.checkoutReservation.findFirstOrThrow({ where: { userId: id } });
        sessionId = reservation.stripeSessionId;
        assert.ok(sessionId);
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        assert.equal(session.livemode, false);
        assert.equal(session.status, "open");
        assert.equal(session.currency, "usd");
        const plan = plans.PLAN_CATALOG[plans.PLAN_DISPLAY[priceKey].plan];
        assert.equal(session.amount_total, (priceKey.endsWith("yearly") ? plan.yearlyPrice : plan.monthlyPrice) * 100);
        assert.equal(session.success_url, "http://localhost:3110/account/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}");
        assert.equal(session.cancel_url, priceKey === "starter_yearly"
          ? "http://localhost:3110/image?mode=agent#pricing" : "http://localhost:3110/pricing");
        const retry = await reservations.createReservedCheckout(params);
        assert.equal(retry.url, first.url);
        assert.equal(await db.checkoutReservation.count({ where: { userId: id } }), 1);
        assert.equal(await db.creditBatch.count({ where: { userId: id } }), 0);
      } finally {
        const pending = sessionId ?? (await db.checkoutReservation.findFirst({ where: { userId: id } }))?.stripeSessionId;
        if (pending) {
          const session = await stripe.checkout.sessions.retrieve(pending);
          if (session.status === "open") await stripe.checkout.sessions.expire(pending);
        }
        await db.user.delete({ where: { id } });
      }
    });
  }

  await t.test("real paid annual invoice grants 200 credits once; cancellation stops future grants", async () => {
    const id = `stripe_audit_${randomUUID()}`;
    const user = await db.user.create({ data: { id, email: `${id}@example.test`, name: "Payment Audit" } });
    let customerId: string | undefined;
    let subId: string | undefined;
    try {
      const customer = await stripe.customers.create({
        email: user.email, name: "Flownana isolated payment audit",
        payment_method: "pm_card_visa", invoice_settings: { default_payment_method: "pm_card_visa" },
        metadata: { audit: "payment-20260922", userId: id },
      });
      assert.equal(customer.livemode, false);
      customerId = customer.id;
      await db.user.update({ where: { id }, data: { stripeCustomerId: customer.id } });
      const sub = await stripe.subscriptions.create({ customer: customer.id,
        items: [{ price: plans.getStripePriceId("starter_yearly") }], payment_behavior: "error_if_incomplete",
        metadata: { userId: id, accountCreatedAt: user.createdAt.toISOString(), audit: "payment-20260922" },
      });
      assert.equal(sub.livemode, false);
      subId = sub.id;
      assert.equal(sub.status, "active");
      assert.equal(typeof sub.latest_invoice, "string");
      const args = { userId: id, sub, invoiceId: sub.latest_invoice as string,
        source: "stripe_sandbox_audit", expectedAccountCreatedAt: user.createdAt.toISOString() };
      assert.equal(await grants.grantCreditsForCurrentPeriodIfNeeded(args), true);
      assert.equal(await grants.grantCreditsForCurrentPeriodIfNeeded(args), false);
      const credits = await db.creditBatch.aggregate({ where: { userId: id }, _sum: { remaining: true }, _count: true });
      assert.equal(credits._sum.remaining, 200);
      assert.equal(credits._count, 1);
      const nextCreditAt = (await db.subscription.findUniqueOrThrow({ where: { stripeSubscriptionId: sub.id } })).nextCreditAt;
      assert.ok(nextCreditAt);
      const due = new Date(nextCreditAt.getTime() + 1_000);
      assert.deepEqual(await grants.grantDueYearlyCredits({ userId: id, stripeSubscriptionId: sub.id, now: due }),
        { granted: 1, duplicates: 0 });
      assert.deepEqual(await grants.grantDueYearlyCredits({ userId: id, stripeSubscriptionId: sub.id, now: due }),
        { granted: 0, duplicates: 0 });
      assert.equal((await db.creditBatch.aggregate({ where: { userId: id }, _sum: { remaining: true } }))._sum.remaining, 400);
      await stripe.subscriptions.cancel(sub.id, { prorate: false });
      assert.equal(await grants.grantCreditsForCurrentPeriodIfNeeded(args), false);
      assert.equal((await db.subscription.findUniqueOrThrow({ where: { stripeSubscriptionId: sub.id } })).status, "canceled");
    } finally {
      if (subId && (await stripe.subscriptions.retrieve(subId)).status !== "canceled") await stripe.subscriptions.cancel(subId, { prorate: false });
      if (customerId) await stripe.customers.del(customerId);
      await db.user.delete({ where: { id } });
    }
  });
});
