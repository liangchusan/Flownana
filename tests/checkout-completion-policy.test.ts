import assert from "node:assert/strict";
import test from "node:test";
import { getCheckoutCompletionError } from "../lib/checkout-completion-policy.ts";

const paidCheckout = {
  mode: "subscription",
  status: "complete",
  paymentStatus: "paid",
  userId: "user-a",
};

test("accepts only a completed paid subscription checkout for the signed-in user", () => {
  assert.equal(getCheckoutCompletionError(paidCheckout, "user-a"), null);
});

test("does not claim success before payment is complete", () => {
  assert.match(
    getCheckoutCompletionError(
      { ...paidCheckout, status: "open", paymentStatus: "unpaid" },
      "user-a"
    ) || "",
    /not complete/
  );
});

test("rejects a checkout belonging to another user", () => {
  assert.match(
    getCheckoutCompletionError(paidCheckout, "user-b") || "",
    /does not belong/
  );
});
