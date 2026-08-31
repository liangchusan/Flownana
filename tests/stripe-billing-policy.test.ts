import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import { getSubscriptionOwnershipError, isPaidInvoiceForSubscriptionPeriod } from "../lib/stripe-billing-policy.ts";

const user = { id: "user", createdAt: new Date("2026-01-01T00:00:00.100Z"), stripeCustomerId: "cus_current" };
const sub = {
  id: "sub_current", customer: user.stripeCustomerId, created: 1767312000,
  metadata: { userId: user.id, accountCreatedAt: user.createdAt.toISOString() },
  current_period_start: 1000, current_period_end: 2000,
  items: { data: [{ id: "si_current", price: { id: "price_current" } }] },
} as unknown as Stripe.Subscription;
const invoice = {
  paid: true, status: "paid", customer: sub.customer, subscription: sub.id,
  lines: { data: [{ type: "subscription", proration: false, subscription: sub.id,
    subscription_item: "si_current", price: { id: "price_current" }, quantity: 1,
    period: { start: 1000, end: 2000 } }] },
} as unknown as Stripe.Invoice;

test("only a paid invoice with the exact subscription, item, price and period authorizes credits", () => {
  assert.equal(isPaidInvoiceForSubscriptionPeriod(invoice, sub), true);
  assert.equal(isPaidInvoiceForSubscriptionPeriod({ ...invoice,
    customer: { id: "cus_current" } as Stripe.Customer,
    subscription: { id: sub.id } as Stripe.Subscription,
  }, sub), true);
  for (const change of [
    { paid: false }, { status: "open" }, { subscription: "sub_other" }, { customer: "cus_other" },
  ]) assert.equal(isPaidInvoiceForSubscriptionPeriod({ ...invoice, ...change } as Stripe.Invoice, sub), false);
  for (const change of [
    { type: "invoiceitem" }, { proration: true }, { subscription: "sub_other" },
    { subscription_item: "si_other" }, { price: { id: "price_old" } }, { quantity: 2 },
    { period: { start: 0, end: 1000 } }, { period: { start: 1000, end: 3000 } },
  ]) assert.equal(isPaidInvoiceForSubscriptionPeriod({ ...invoice,
    lines: { ...invoice.lines, data: [{ ...invoice.lines.data[0], ...change }] },
  } as Stripe.Invoice, sub), false);
});

test("ownership preserves legacy customer bindings but rejects old account epochs and other customers", () => {
  assert.equal(getSubscriptionOwnershipError(user, sub), null);
  assert.equal(getSubscriptionOwnershipError(user, { ...sub, metadata: {} }), null);
  assert.equal(getSubscriptionOwnershipError({ ...user, stripeCustomerId: null }, sub), null);
  const ownershipChanges: Partial<Pick<Stripe.Subscription, "customer" | "metadata">>[] = [
    { customer: "cus_other" }, { metadata: { userId: "another" } },
    { metadata: { userId: user.id, accountCreatedAt: "2025-01-01T00:00:00.000Z" } },
  ];
  for (const changed of ownershipChanges) assert.ok(getSubscriptionOwnershipError(user, { ...sub, ...changed }));
  const unbound = { ...user, stripeCustomerId: null };
  assert.ok(getSubscriptionOwnershipError(unbound, { ...sub, metadata: {} }));
  assert.ok(getSubscriptionOwnershipError(unbound, { ...sub,
    metadata: { userId: user.id }, created: Math.floor(user.createdAt.getTime() / 1000) - 1,
  }));
  assert.ok(getSubscriptionOwnershipError(unbound, { ...sub, metadata: { userId: user.id } }));
  assert.equal(getSubscriptionOwnershipError(unbound, { ...sub, metadata: { userId: user.id } }, sub.created), null);
  assert.ok(getSubscriptionOwnershipError(unbound, { ...sub, metadata: { userId: user.id } },
    Math.floor(user.createdAt.getTime() / 1000) - 1));
});
