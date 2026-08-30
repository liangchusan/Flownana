import assert from "node:assert/strict";
import test from "node:test";
import {
  canCreateStripeCheckout,
  canFinalizeStripeCheckout,
  isStripeTestModeSecret,
  shouldIgnoreStripeTestWebhook,
} from "../lib/stripe-production-access.ts";

test("detects Stripe test-mode secret keys without exposing their value", () => {
  assert.equal(isStripeTestModeSecret("sk_test_example"), true);
  assert.equal(isStripeTestModeSecret("rk_test_example"), true);
  assert.equal(isStripeTestModeSecret("sk_live_example"), false);
  assert.equal(isStripeTestModeSecret("rk_live_example"), false);
  assert.equal(isStripeTestModeSecret(undefined), false);
});

test("production test-mode checkout is limited to the explicit email allowlist", () => {
  const base = {
    secretKey: "sk_test_example",
    vercelEnv: "production",
    allowedEmails: "qa@example.com, owner@example.com",
  };

  assert.equal(canCreateStripeCheckout({ ...base, email: "public@example.com" }), false);
  assert.equal(canCreateStripeCheckout({ ...base, email: " QA@example.com " }), true);
  assert.equal(
    canFinalizeStripeCheckout({
      email: "public@example.com",
      livemode: false,
      vercelEnv: "production",
      allowedEmails: base.allowedEmails,
    }),
    false
  );
});

test("live checkout and non-production test checkout remain available", () => {
  assert.equal(
    canCreateStripeCheckout({
      email: "public@example.com",
      secretKey: "sk_live_example",
      vercelEnv: "production",
      allowedEmails: undefined,
    }),
    true
  );
  assert.equal(
    canCreateStripeCheckout({
      email: "public@example.com",
      secretKey: "sk_test_example",
      vercelEnv: "preview",
      allowedEmails: undefined,
    }),
    true
  );
  assert.equal(
    canFinalizeStripeCheckout({
      email: "public@example.com",
      livemode: true,
      vercelEnv: "production",
      allowedEmails: undefined,
    }),
    true
  );
});

test("production ignores valid Stripe test-mode webhook events", () => {
  assert.equal(
    shouldIgnoreStripeTestWebhook({ livemode: false, vercelEnv: "production" }),
    true
  );
  assert.equal(
    shouldIgnoreStripeTestWebhook({ livemode: true, vercelEnv: "production" }),
    false
  );
  assert.equal(
    shouldIgnoreStripeTestWebhook({ livemode: false, vercelEnv: "preview" }),
    false
  );
});
