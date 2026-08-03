import assert from "node:assert/strict";
import test from "node:test";
import { getStripeStateSyncKind } from "../lib/stripe-event-policy.ts";

test("subscription lifecycle events trigger subscription state sync", () => {
  for (const eventType of [
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "customer.subscription.paused",
    "customer.subscription.resumed",
  ]) {
    assert.equal(getStripeStateSyncKind(eventType), "subscription");
  }
});

test("invoice failure events trigger subscription state sync", () => {
  for (const eventType of [
    "invoice.payment_failed",
    "invoice.payment_action_required",
    "invoice.finalization_failed",
  ]) {
    assert.equal(getStripeStateSyncKind(eventType), "invoice");
  }
});

test("credit-grant events stay in their dedicated webhook paths", () => {
  assert.equal(getStripeStateSyncKind("invoice.paid"), null);
  assert.equal(getStripeStateSyncKind("checkout.session.completed"), null);
});
